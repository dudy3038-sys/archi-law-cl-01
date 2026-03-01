// src/server/parkingDB.js (FULL REPLACE)
// ✅ 전국 자치법규(주차) 인덱스 적재/조회용 DB 모듈
// - parking_jurisdiction / parking_ordinance_index / parking_ordinance_text / parking_rules
// - orgName(지자체기관명)에서 (시도/시군구) 파싱해서 jurKey로 저장
//
// 설계 의도:
// 1) 크롤러는 "전국 단위로 넓게" ordin list를 긁는다
// 2) 여기서 orgName을 파싱해 jurKey를 만들고, index를 DB에 계속 쌓는다
// 3) 다음 단계에서 ordin_id별 본문/별표를 저장(parking_ordinance_text)하고,
// 4) 설치기준을 파싱해 parking_rules를 채우면, UI 산정이 자동으로 실데이터 기반으로 전환됨

import {
  SIDO_LIST,
  cleanText,
  normalizeSido,
  normalizeSigungu,
} from "../crawler/cityList.js";

export function makeJurKey(sido, sigungu) {
  return `${sido}__${sigungu}`;
}

function normSpace(s) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripParen(s) {
  return String(s ?? "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * ✅ orgName(지자체기관명)에서 {sido, sigungu} 뽑기
 * 예) "서울특별시 성동구", "서울특별시성동구", "경기도 수원시", "부산광역시 해운대구청"
 *
 * 반환이 애매하면 null (그건 다음 단계에서 보완/예외처리)
 */
export function parseJurisdictionFromOrgName(orgName) {
  const raw = stripParen(cleanText(normSpace(orgName)));
  if (!raw) return null;

  // 1) 시도 찾기: SIDO_LIST 중 포함되는 가장 긴 매칭 우선
  const candidates = [...SIDO_LIST].sort((a, b) => b.length - a.length);
  let sido = "";
  for (const s of candidates) {
    if (raw.includes(s)) {
      sido = s;
      break;
    }
  }
  if (!sido) return null;

  // 2) 시군구 후보 텍스트
  let rest = raw.replace(sido, "").trim();

  // "성동구청" 같은 경우
  rest = rest.replace(/^\s+/, "").replace(/\s+/g, " ");

  // 공백 없이 붙어있는 경우 대비: "서울특별시성동구"
  // rest가 비었으면 raw에서 sido 다음 문자열을 다시 추출
  if (!rest) {
    const idx = raw.indexOf(sido);
    rest = raw.slice(idx + sido.length).trim();
  }

  // 3) 시군구 토큰 추정
  // 우선 공백 기준 첫 토큰
  let token = rest.split(" ")[0] || "";
  token = token.replace(/(청|시청|군청|구청)$/g, ""); // 말단 '구청' 등 제거

  // 토큰이 너무 짧거나 이상하면, 한글 연속 덩어리로 재추출
  if (!token || token.length < 2) {
    const m = rest.match(/[가-힣]{2,}(시|군|구)/);
    token = m ? m[0] : "";
  }

  // 시/군/구로 끝나는 형태만 인정
  if (!/(시|군|구)$/.test(token)) {
    // 그래도 "성동"만 온 경우 -> "성동구" 보정 시도
    if (token && rest.includes(token + "구")) token = token + "구";
    else if (token && rest.includes(token + "군")) token = token + "군";
    else if (token && rest.includes(token + "시")) token = token + "시";
  }

  let sigungu = normalizeSigungu(token);
  if (!sigungu) return null;

  // normalizeSido/normalizeSigungu로 정규화(안전)
  sido = normalizeSido(sido);
  sigungu = normalizeSigungu(sigungu);

  if (!sido || !sigungu) return null;

  return { sido, sigungu };
}

// -------------------------
// DB upsert helpers
// -------------------------
export async function upsertJurisdiction(db, { jurKey, sido, sigungu }) {
  await db
    .prepare(
      `INSERT OR REPLACE INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .bind(jurKey, sido, sigungu)
    .run();
}

export async function upsertOrdinIndexBatch(db, { jurKey, items }) {
  if (!items?.length) return 0;

  const stmts = items.map((it) =>
    db
      .prepare(
        `INSERT OR REPLACE INTO parking_ordinance_index
         (jur_key, ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link, collected_at, updated_at)
         VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .bind(
        jurKey,
        String(it.ordinId ?? it.ordin_id ?? it.MST ?? it.mst ?? ""),
        String(it.name ?? ""),
        it.orgName ?? it.org_name ?? null,
        it.kind ?? null,
        it.field ?? null,
        it.effDate ?? it.eff_date ?? null,
        it.annDate ?? it.ann_date ?? null,
        it.annNo ?? it.ann_no ?? null,
        it.link ?? null
      )
  );

  await db.batch(stmts);
  return items.length;
}

/**
 * ✅ 전국 인덱스 적재(핵심)
 * - rows: 크롤러가 DRF에서 받은 ordin list 정규화 결과 배열(ordinId/name/orgName/...)
 * - orgName에서 jurKey를 만들고, jur별로 그룹핑하여 DB에 쌓음
 */
export async function ingestNationwideOrdinIndex(db, { rows }) {
  const out = {
    ok: true,
    received: Array.isArray(rows) ? rows.length : 0,
    jurisdictions: 0,
    index_rows: 0,
    skipped_no_orgName: 0,
    skipped_no_jur: 0,
  };

  if (!Array.isArray(rows) || rows.length === 0) return out;

  // jurKey -> items[]
  const bucket = new Map();

  for (const r of rows) {
    const orgName = r?.orgName ?? r?.org_name ?? "";
    if (!orgName) {
      out.skipped_no_orgName += 1;
      continue;
    }

    const jur = parseJurisdictionFromOrgName(orgName);
    if (!jur) {
      out.skipped_no_jur += 1;
      continue;
    }

    const jurKey = makeJurKey(jur.sido, jur.sigungu);
    if (!bucket.has(jurKey)) bucket.set(jurKey, { jur, items: [] });

    bucket.get(jurKey).items.push(r);
  }

  // DB upsert
  for (const [jurKey, pack] of bucket.entries()) {
    await upsertJurisdiction(db, {
      jurKey,
      sido: pack.jur.sido,
      sigungu: pack.jur.sigungu,
    });
    out.jurisdictions += 1;

    // 큰 batch 방지: 50개씩 쪼개기
    const CHUNK = 50;
    for (let i = 0; i < pack.items.length; i += CHUNK) {
      const part = pack.items.slice(i, i + CHUNK);
      const n = await upsertOrdinIndexBatch(db, { jurKey, items: part });
      out.index_rows += n;
    }
  }

  return out;
}

// -------------------------
// Query helpers (UI/디버그용)
// -------------------------
export async function listJurisdictions(db, { limit = 50, offset = 0 } = {}) {
  const { results } = await db
    .prepare(
      `SELECT jur_key, sido, sigungu, updated_at
       FROM parking_jurisdiction
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all();
  return results || [];
}

export async function countIndexByJurKey(db, jurKey) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM parking_ordinance_index
       WHERE jur_key = ?`
    )
    .bind(jurKey)
    .first();
  return Number(row?.cnt || 0);
}

export async function listIndexByJurKey(db, jurKey, { limit = 50, offset = 0 } = {}) {
  const { results } = await db
    .prepare(
      `SELECT ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link, collected_at
       FROM parking_ordinance_index
       WHERE jur_key = ?
       ORDER BY ann_date DESC, eff_date DESC, collected_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(jurKey, limit, offset)
    .all();
  return results || [];
}

export async function getRulesByJurKey(db, jurKey) {
  const { results } = await db
    .prepare(
      `SELECT use_label, unit, value_num, note, source, updated_at
       FROM parking_rules
       WHERE jur_key = ?
       ORDER BY use_label ASC`
    )
    .bind(jurKey)
    .all();
  return results || [];
}