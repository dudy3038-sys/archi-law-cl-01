// src/server/parkingDB.js (FULL REPLACE)
//
// ✅ 목적
// - D1에 "주차 조례 인덱스/본문/설치기준 규칙"을 쌓고,
// - /api/parking/legal에서 즉시 사용 가능한 형태로 조회/산정 지원.
//
// ✅ 현재 단계(1차):
// - parking_jurisdiction / parking_ordinance_index / parking_ordinance_text / parking_rules 기반
// - 규칙이 있으면 DB 기반 산정, 없으면 NO_RULES_YET로 명확히 리턴
//
// ✅ 다음 단계(2차 예정):
// - parkingParser.js로 ordin_text(별표) 파싱 → parking_rules 자동 적재
// - rounding_policy / use_label 표준화 매핑 개선

function jurKeyOf(sido, sigungu) {
    return `${String(sido || "").trim()}__${String(sigungu || "").trim()}`;
  }
  
  function uniq(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }
  
  function normalizeStr(x) {
    return String(x ?? "").trim();
  }
  
  function normalizeUse(x) {
    return normalizeStr(x).replace(/\s+/g, " ");
  }
  
  function safeNum(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }
  
  /**
   * 관할 fallback 키:
   * - 1순위: 시군구
   * - 2순위: 광역(전체)
   * - 3순위: 광역(시도명)
   */
  export function buildJurFallbackKeys({ sido, sigungu }) {
    const s = normalizeStr(sido);
    const g = normalizeStr(sigungu);
    const keys = [];
    if (s && g) keys.push(jurKeyOf(s, g));
    if (s) {
      keys.push(jurKeyOf(s, "전체"));
      keys.push(jurKeyOf(s, s));
    }
    return uniq(keys);
  }
  
  /* =========================================================
     Jurisdiction upsert
  ========================================================= */
  export async function ensureParkingJurisdiction(DB, { sido, sigungu }) {
    const s = normalizeStr(sido);
    const g = normalizeStr(sigungu);
    if (!s || !g) throw new Error("MISSING_JURISDICTION");
  
    const jur_key = jurKeyOf(s, g);
  
    await DB.prepare(
      `
      INSERT OR IGNORE INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `
    )
      .bind(jur_key, s, g)
      .run();
  
    await DB.prepare(
      `UPDATE parking_jurisdiction SET updated_at=datetime('now') WHERE jur_key=?`
    )
      .bind(jur_key)
      .run();
  
    return jur_key;
  }
  
  /* =========================================================
     Index upsert
  ========================================================= */
  export async function upsertParkingIndex(DB, { jur_key, items }) {
    if (!jur_key) throw new Error("MISSING_JUR_KEY");
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return { wrote: 0 };
  
    const CHUNK = 50;
    let wrote = 0;
  
    for (let i = 0; i < list.length; i += CHUNK) {
      const part = list.slice(i, i + CHUNK);
  
      const stmts = part.map((it) => {
        const ordin_id = normalizeStr(it.ordinId || it.ordin_id || "");
        const name = normalizeStr(it.name || "");
        if (!ordin_id || !name) return null;
  
        return DB.prepare(
          `
          INSERT OR REPLACE INTO parking_ordinance_index
            (jur_key, ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link, collected_at, updated_at)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `
        ).bind(
          jur_key,
          ordin_id,
          name,
          it.orgName ? String(it.orgName) : null,
          it.kind ? String(it.kind) : null,
          it.field ? String(it.field) : null,
          it.effDate ? String(it.effDate) : null,
          it.annDate ? String(it.annDate) : null,
          it.annNo ? String(it.annNo) : null,
          it.link ? String(it.link) : null
        );
      }).filter(Boolean);
  
      if (stmts.length) {
        await DB.batch(stmts);
        wrote += stmts.length;
      }
    }
  
    return { wrote };
  }
  
  /* =========================================================
     Index query
  ========================================================= */
  export async function listParkingIndex(DB, { sido, sigungu, limit = 50 }) {
    const keys = buildJurFallbackKeys({ sido, sigungu });
    const lim = Math.max(1, Math.min(200, safeNum(limit, 50)));
  
    for (const jur_key of keys) {
      const res = await DB.prepare(
        `
        SELECT
          jur_key, ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link, collected_at, updated_at
        FROM parking_ordinance_index
        WHERE jur_key = ?
        ORDER BY ann_date DESC, eff_date DESC, id DESC
        LIMIT ?
      `
      )
        .bind(jur_key, lim)
        .all();
  
      const rows = Array.isArray(res?.results) ? res.results : [];
      if (rows.length) {
        return {
          ok: true,
          jur_key,
          tried: keys,
          rows: rows.map((r) => ({
            jur_key: r.jur_key,
            ordin_id: r.ordin_id,
            name: r.name,
            org_name: r.org_name || null,
            kind: r.kind || null,
            field: r.field || null,
            eff_date: r.eff_date || null,
            ann_date: r.ann_date || null,
            ann_no: r.ann_no || null,
            link: r.link || null,
            collected_at: r.collected_at || null,
            updated_at: r.updated_at || null,
          })),
        };
      }
    }
  
    return { ok: true, jur_key: null, tried: keys, rows: [] };
  }
  
  /* =========================================================
     Ordinance text upsert/get (다음 단계에서 사용)
  ========================================================= */
  export async function upsertParkingOrdinanceText(DB, payload) {
    const ordin_id = normalizeStr(payload?.ordin_id || payload?.ordinId || "");
    if (!ordin_id) throw new Error("MISSING_ORDIN_ID");
  
    const jur_key = payload?.jur_key ? String(payload.jur_key) : null;
    const name = payload?.name ? String(payload.name) : null;
    const source_url = payload?.source_url ? String(payload.source_url) : null;
    const raw_json = payload?.raw_json ? String(payload.raw_json) : null;
    const body_text = payload?.body_text ? String(payload.body_text) : null;
    const tables_text = payload?.tables_text ? String(payload.tables_text) : null;
  
    await DB.prepare(
      `
      INSERT OR REPLACE INTO parking_ordinance_text
        (ordin_id, jur_key, name, source_url, raw_json, body_text, tables_text, collected_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    )
      .bind(ordin_id, jur_key, name, source_url, raw_json, body_text, tables_text)
      .run();
  
    return { ok: true, ordin_id };
  }
  
  export async function getParkingOrdinanceText(DB, { ordin_id }) {
    const id = normalizeStr(ordin_id);
    if (!id) throw new Error("MISSING_ORDIN_ID");
  
    const row = await DB.prepare(
      `
      SELECT
        ordin_id, jur_key, name, source_url, raw_json, body_text, tables_text, collected_at, updated_at
      FROM parking_ordinance_text
      WHERE ordin_id = ?
      LIMIT 1
    `
    )
      .bind(id)
      .first();
  
    if (!row) return null;
  
    return {
      ordin_id: row.ordin_id,
      jur_key: row.jur_key || null,
      name: row.name || null,
      source_url: row.source_url || null,
      raw_json: row.raw_json || null,
      body_text: row.body_text || null,
      tables_text: row.tables_text || null,
      collected_at: row.collected_at || null,
      updated_at: row.updated_at || null,
    };
  }
  
  /* =========================================================
     Rules query / upsert (파서 결과 적재용)
  ========================================================= */
  export async function listParkingRules(DB, { jur_key }) {
    const k = normalizeStr(jur_key);
    if (!k) throw new Error("MISSING_JUR_KEY");
  
    const res = await DB.prepare(
      `
      SELECT
        id, jur_key, ordin_id, use_label, unit, value_num, note, source, updated_at
      FROM parking_rules
      WHERE jur_key = ?
      ORDER BY use_label ASC, id ASC
    `
    )
      .bind(k)
      .all();
  
    const rows = Array.isArray(res?.results) ? res.results : [];
    return rows.map((r) => ({
      id: r.id,
      jur_key: r.jur_key,
      ordin_id: r.ordin_id || null,
      use_label: r.use_label,
      unit: r.unit,
      value_num: safeNum(r.value_num),
      note: r.note || null,
      source: r.source || null,
      updated_at: r.updated_at || null,
    }));
  }
  
  export async function upsertParkingRules(DB, { jur_key, rules }) {
    const k = normalizeStr(jur_key);
    if (!k) throw new Error("MISSING_JUR_KEY");
    const list = Array.isArray(rules) ? rules : [];
    if (!list.length) return { wrote: 0 };
  
    const CHUNK = 50;
    let wrote = 0;
  
    for (let i = 0; i < list.length; i += CHUNK) {
      const part = list.slice(i, i + CHUNK);
  
      const stmts = part.map((r) => {
        const use_label = normalizeUse(r?.use_label || r?.use || "");
        const unit = normalizeStr(r?.unit || "");
        const value_num = safeNum(r?.value_num, NaN);
        if (!use_label || !unit || !Number.isFinite(value_num)) return null;
  
        return DB.prepare(
          `
          INSERT INTO parking_rules
            (jur_key, ordin_id, use_label, unit, value_num, note, source, updated_at)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `
        ).bind(
          k,
          r?.ordin_id ? String(r.ordin_id) : null,
          use_label,
          unit,
          value_num,
          r?.note ? String(r.note) : null,
          r?.source ? String(r.source) : null
        );
      }).filter(Boolean);
  
      if (stmts.length) {
        await DB.batch(stmts);
        wrote += stmts.length;
      }
    }
  
    return { wrote };
  }
  
  /* =========================================================
     Parking calculation (DB rules)
  ========================================================= */
  function calcByRule({ area_m2, rule }) {
    const unit = normalizeStr(rule?.unit);
  
    // 1단계 지원: m2_per_space (value_num = 몇 ㎡당 1대)
    if (unit === "m2_per_space") {
      const denom = safeNum(rule?.value_num, NaN);
      if (!Number.isFinite(denom) || denom <= 0) return null;
      const raw = area_m2 / denom;
      const rounded = Math.ceil(raw);
      return { raw, rounded, formula: `ceil(${area_m2} / ${denom})` };
    }
  
    return null;
  }
  
  function pickRuleForUse(rules, useLabel) {
    const use = normalizeUse(useLabel);
    if (!use) return null;
  
    // ✅ 가장 단순한 매칭(확장 예정)
    // 1) 완전일치
    let hit = rules.find((r) => normalizeUse(r.use_label) === use);
    if (hit) return hit;
  
    // 2) 포함
    hit = rules.find((r) => normalizeUse(r.use_label).includes(use));
    if (hit) return hit;
  
    // 3) 반대 포함
    hit = rules.find((r) => use.includes(normalizeUse(r.use_label)));
    if (hit) return hit;
  
    return null;
  }
  
  /**
   * payload:
   * {
   *  jurisdiction: { sido, sigungu },
   *  usageAreas: [{ use, area_m2 }],
   *  primaryUse
   * }
   */
  export async function computeParkingLegal(DB, payload) {
    const sido = normalizeStr(payload?.jurisdiction?.sido);
    const sigungu = normalizeStr(payload?.jurisdiction?.sigungu);
    if (!sido || !sigungu) throw new Error("MISSING_JURISDICTION");
  
    const usageAreas = Array.isArray(payload?.usageAreas) ? payload.usageAreas : [];
    if (!usageAreas.length) throw new Error("MISSING_USAGE_AREAS");
  
    const fallbacks = buildJurFallbackKeys({ sido, sigungu });
  
    let usedJurKey = "";
    let rules = [];
    for (const k of fallbacks) {
      const got = await listParkingRules(DB, { jur_key: k });
      if (got.length) {
        usedJurKey = k;
        rules = got;
        break;
      }
    }
  
    const totalArea =
      Math.round(
        usageAreas.reduce((acc, x) => acc + safeNum(x?.area_m2, 0), 0) * 100
      ) / 100;
  
    // 규칙이 아직 없으면, “명확히” NO_RULES_YET
    if (!rules.length) {
      const tmp = Math.max(1, Math.ceil(totalArea / 1000));
      return {
        ok: true,
        mode: "NO_RULES_YET",
        usedJurKey: null,
        totalArea_m2: totalArea,
        legalCount: tmp,
        breakdown: [],
        formula:
          `NO_RULES_YET: parking_rules가 비어있어 임시값. ceil(totalArea_m2/1000), 최소 1대 (총면적=${totalArea}㎡)`,
        refs: [],
        debug: { triedJurKeys: fallbacks },
      };
    }
  
    const breakdown = [];
    let sumRaw = 0;
  
    for (const ua of usageAreas) {
      const use = normalizeUse(ua?.use);
      const area_m2 = safeNum(ua?.area_m2, 0);
  
      const rule = pickRuleForUse(rules, use);
      if (!rule) {
        breakdown.push({
          use,
          area_m2,
          rule: null,
          count_raw: null,
          count_rounded: null,
          note: "NO_MATCHING_RULE",
        });
        continue;
      }
  
      const out = calcByRule({ area_m2, rule });
      if (!out) {
        breakdown.push({
          use,
          area_m2,
          rule,
          count_raw: null,
          count_rounded: null,
          note: "UNSUPPORTED_RULE_UNIT",
        });
        continue;
      }
  
      sumRaw += out.raw;
      breakdown.push({
        use,
        area_m2,
        rule,
        count_raw: out.raw,
        count_rounded: out.rounded,
        formula: out.formula,
      });
    }
  
    const legalCount = Math.max(1, Math.ceil(sumRaw));
  
    const ordinIds = uniq(
      rules.map((r) => (r.ordin_id ? String(r.ordin_id) : ""))
    );
  
    return {
      ok: true,
      mode: "DB_RULES",
      usedJurKey,
      totalArea_m2: totalArea,
      legalCount,
      breakdown,
      formula: `DB_RULES: total=ceil(sum(count_raw)) => ceil(${sumRaw})`,
      refs: ordinIds.map((id) => ({ type: "ordin", ordin_id: id })),
      debug: {
        triedJurKeys: fallbacks,
        rulesCount: rules.length,
        ordinIds,
      },
    };
  }
  
  export default {
    jurKeyOf,
    buildJurFallbackKeys,
    ensureParkingJurisdiction,
    upsertParkingIndex,
    listParkingIndex,
    upsertParkingOrdinanceText,
    getParkingOrdinanceText,
    listParkingRules,
    upsertParkingRules,
    computeParkingLegal,
  };