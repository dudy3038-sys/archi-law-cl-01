// src/server/parkingDB.js (FULL REPLACE)
//
// ✅ 목적
// - D1(Cloudflare)에서 주차 관련 조례/규칙 데이터를 읽고
// - 주차대수(법정/조례 기준) 산정을 위한 "DB 기반 계산"을 제공
//
// ✅ 현재 단계(진짜 전진용)
// 1) parking_jurisdiction / parking_ordinance_index 를 조회할 수 있게
// 2) parking_rules(파싱된 설치기준)가 있으면 그걸로 주차대수 산정
// 3) 아직 rules가 없으면 "NO_RULES_YET"로 명확히 반환(허수 테스트 줄이기)
//
// ⚠️ 다음 단계(곧 연결)
// - parking_ordinance_text(본문/별표) 적재 + parkingParser.js로 rules 생성 → parking_rules 채우기
// - 그 다음부터는 이 파일이 곧바로 실제 산정값을 내게 됨.

function norm(s) {
  return String(s ?? "").trim();
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function makeJurKey(sido, sigungu) {
  // schema.sql에서 jur_key 예시가 "__" 사용
  return `${norm(sido)}__${norm(sigungu)}`;
}

export async function ensureParkingJurisdiction(DB, { sido, sigungu }) {
  const s1 = norm(sido);
  const s2 = norm(sigungu);
  if (!s1 || !s2) throw new Error("MISSING_JURISDICTION");

  const jurKey = makeJurKey(s1, s2);

  await DB.prepare(
    `INSERT OR REPLACE INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
     VALUES (?, ?, ?, datetime('now'))`
  )
    .bind(jurKey, s1, s2)
    .run();

  return jurKey;
}

export async function listParkingOrdinanceIndex(DB, { jurKey, limit = 50 }) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  const rows = await DB.prepare(
    `SELECT
        jur_key, ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link,
        collected_at, updated_at
     FROM parking_ordinance_index
     WHERE jur_key = ?
     ORDER BY ann_date DESC, updated_at DESC
     LIMIT ?`
  )
    .bind(String(jurKey), lim)
    .all();

  return rows?.results || [];
}

export async function getParkingRulesByJurisdiction(DB, { jurKey }) {
  const rows = await DB.prepare(
    `SELECT
        id, jur_key, ordin_id, use_label, unit, value_num, note, source, updated_at
     FROM parking_rules
     WHERE jur_key = ?
     ORDER BY use_label ASC, value_num ASC`
  )
    .bind(String(jurKey))
    .all();

  return rows?.results || [];
}

/**
 * ✅ 규칙 매칭(초기 버전)
 * - usageAreas[].use(예: "업무시설")와 rule.use_label을 느슨하게 포함매칭
 * - 못 맞추면 "기타" 규칙 사용 시도
 */
function pickBestRuleForUse(rules, useLabel) {
  const u = norm(useLabel);
  if (!u) return null;

  // 1) 정확/포함 매칭
  const direct = rules.find((r) => {
    const rl = norm(r.use_label);
    return rl && (u.includes(rl) || rl.includes(u));
  });
  if (direct) return direct;

  // 2) 기타 fallback
  const etc = rules.find((r) => norm(r.use_label) === "기타");
  return etc || null;
}

/**
 * ✅ DB 규칙 기반 주차대수 산정(현재 지원 unit: m2_per_space)
 * - 각 용도 면적에 대해: ceil(area_m2 / denom_m2)
 * - 합산
 */
export function calcParkingByRules({ rules, usageAreas }) {
  const usableRules = Array.isArray(rules) ? rules : [];
  const areas = Array.isArray(usageAreas) ? usageAreas : [];

  let total = 0;
  const breakdown = [];

  for (const a of areas) {
    const use = norm(a?.use);
    const area = safeNum(a?.area_m2);

    if (!use || area <= 0) continue;

    const rule = pickBestRuleForUse(usableRules, use);

    if (!rule) {
      breakdown.push({
        use,
        area_m2: area,
        matched: false,
        unit: null,
        value_num: null,
        count: 0,
        note: "NO_MATCHING_RULE",
      });
      continue;
    }

    const unit = norm(rule.unit);
    const v = safeNum(rule.value_num);

    if (unit !== "m2_per_space" || v <= 0) {
      breakdown.push({
        use,
        area_m2: area,
        matched: true,
        unit: unit || null,
        value_num: v || null,
        count: 0,
        note: "UNSUPPORTED_RULE_UNIT_OR_VALUE",
      });
      continue;
    }

    const cnt = Math.max(0, Math.ceil(area / v));
    total += cnt;

    breakdown.push({
      use,
      area_m2: area,
      matched: true,
      unit,
      value_num: v,
      count: cnt,
      source: rule.source || null,
      ordin_id: rule.ordin_id || null,
    });
  }

  return { total, breakdown };
}

/**
 * ✅ 외부(API)에서 쓰는 최종 진입점
 * - rules 있으면 DB 기반 산정
 * - 없으면 NO_RULES_YET 반환
 */
export async function computeLegalParking(DB, payload) {
  const jurisdiction = payload?.jurisdiction || {};
  const sido = norm(jurisdiction?.sido);
  const sigungu = norm(jurisdiction?.sigungu);

  const usageAreasIn = Array.isArray(payload?.usageAreas) ? payload.usageAreas : [];
  const usageAreas = usageAreasIn
    .map((x) => ({
      use: norm(x?.use),
      area_m2: Math.round(safeNum(x?.area_m2) * 100) / 100,
    }))
    .filter((x) => x.use && x.area_m2 > 0);

  if (!sido || !sigungu) {
    return {
      ok: false,
      error: "MISSING_PARAMS",
      need: ["jurisdiction.sido", "jurisdiction.sigungu"],
    };
  }
  if (!usageAreas.length) {
    return {
      ok: false,
      error: "MISSING_PARAMS",
      need: ["usageAreas (use, area_m2 > 0)"],
    };
  }

  const jurKey = makeJurKey(sido, sigungu);

  const rules = await getParkingRulesByJurisdiction(DB, { jurKey });

  // ✅ 아직 규칙이 없으면, "테스트 계산" 말고 명확히 NO_RULES_YET를 리턴
  if (!rules.length) {
    const idxCountRow = await DB.prepare(
      `SELECT COUNT(*) AS cnt FROM parking_ordinance_index WHERE jur_key = ?`
    )
      .bind(jurKey)
      .first();

    const idxCount = Number(idxCountRow?.cnt || 0);

    return {
      ok: true,
      mode: "NO_RULES_YET",
      jurisdiction: { sido, sigungu },
      jurKey,
      usageAreas,
      legalParking: null,
      message:
        "parking_rules(설치기준 파싱 결과)가 아직 없습니다. 먼저 조례 본문/별표 적재 → 파싱 → parking_rules 채우기가 필요합니다.",
      debug: {
        index_rows_in_db: idxCount,
        rules_rows_in_db: 0,
      },
      refs: [],
    };
  }

  const { total, breakdown } = calcParkingByRules({ rules, usageAreas });

  // 최소 1대 같은 최소치 정책은 지자체마다 달라서 여기서는 강제하지 않음(다음 단계에서 옵션화)
  return {
    ok: true,
    mode: "DB_RULES",
    jurisdiction: { sido, sigungu },
    jurKey,
    usageAreas,
    legalParking: total,
    legalCount: total,
    breakdown,
    message: "DB(parking_rules) 기반으로 주차대수를 산정했습니다.",
    refs: [], // 다음 단계에서 breakdown.source → refs 변환 가능
    debug: {
      rules_rows_in_db: rules.length,
    },
  };
}