// src/crawler/parkingCrawler.js (FULL REPLACE)
// ✅ 실수집 + 즉시 DB 적재 + (2단계) 조례 본문 저장 + (2.5단계) 설치기준 파싱/적재 + 전국/전체 지원 버전
//
// 추가된 핵심(2.5단계):
// - parking_ordinance_text에서 방금 저장한 본문을 읽어
// - parkingParser.js로 "㎡당 1대"류 규칙을 뽑아
// - parking_rules 테이블에 INSERT OR REPLACE로 저장
//
// 기대 결과:
// - /api/crawler/parking/run 호출 응답에 saved.rules_rows가 생김
// - UI에서 "설치기준 파싱"이 ✅로 바뀔 준비 완료
//
// ⚠️ 실제 산정(legal 계산)은 parking_rules를 읽어서 계산하는 서버 로직이 연결되어 있어야 함
//   (그건 다음 단계에서 확인/수정)

import {
  SIDO_LIST,
  cleanText,
  normalizeSido,
  normalizeSigungu,
} from "./cityList.js";

import {
  parseParkingRulesFromOrdinanceTextRow,
} from "./parkingParser.js";

const DRF_BASE = "https://www.law.go.kr/DRF/lawSearch.do";
const LAW_SERVICE_URL = "https://www.law.go.kr/DRF/lawService.do";
const ORDIN_SEARCH_UI = "https://www.law.go.kr/ordinSc.do";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function safeJsonStringify(x) {
  try {
    return JSON.stringify(x);
  } catch {
    return null;
  }
}

const FALLBACK_ORG_MAP = new Map([
  ["서울특별시", "6110000"],
  ["부산광역시", "6260000"],
  ["대구광역시", "6270000"],
  ["인천광역시", "6280000"],
  ["광주광역시", "6290000"],
  ["대전광역시", "6300000"],
  ["울산광역시", "6310000"],
  ["세종특별자치시", "5690000"],
  ["경기도", "6410000"],
  ["강원특별자치도", "6420000"],
  ["충청북도", "6430000"],
  ["충청남도", "6440000"],
  ["전북특별자치도", "6450000"],
  ["전라남도", "6460000"],
  ["경상북도", "6470000"],
  ["경상남도", "6480000"],
  ["제주특별자치도", "6500000"],
]);

function isAllToken(x) {
  const s = String(x ?? "").trim();
  return s === "*" || s === "전체" || s === "전국" || s === "all" || s === "ALL";
}

async function fetchWithRetry(url, opts = {}, retry = 3) {
  let lastErr = null;
  for (let i = 0; i <= retry; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "archi-law-crawler/1.0", ...(opts.headers || {}) },
        ...opts,
      });

      if (!res.ok) {
        const status = res.status;
        const text = await res.text().catch(() => "");
        const msg = `HTTP_${status}: ${text.slice(0, 200)}`;

        const retryable =
          status === 408 ||
          status === 425 ||
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          status === 520 ||
          status === 522 ||
          status === 523 ||
          status === 524 ||
          status === 525;

        if (retryable && i < retry) {
          await sleep(250 * Math.pow(2, i) + Math.floor(Math.random() * 120));
          continue;
        }
        throw new Error(msg);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retry) {
        await sleep(250 * Math.pow(2, i) + Math.floor(Math.random() * 120));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new Error("FETCH_FAILED");
}

async function fetchText(url) {
  const res = await fetchWithRetry(url, { headers: { accept: "text/html,*/*" } }, 3);
  return await res.text();
}

async function fetchJson(url) {
  const res = await fetchWithRetry(
    url,
    { headers: { accept: "application/json,text/plain,*/*" } },
    3
  );
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`NOT_JSON: ${text.slice(0, 120)}`);
  }
}

function buildUrl(params) {
  const u = new URL(DRF_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    u.searchParams.set(k, s);
  });
  return u.toString();
}

/**
 * ✅ DRF ordin 검색 결과가 다양한 형태로 올 수 있음
 * - { OrdinSearch: { law: [...] } }
 * - { ordinSearch: { law: [...] } }
 * - { 자치법규: { 자치법규: [...] } } 등
 */
function pickListAny(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  const os = data?.OrdinSearch || data?.ordinSearch || data?.ORDINSEARCH;
  const osLaw = os?.law || os?.Law || os?.list || os?.items;
  if (Array.isArray(osLaw)) return osLaw;

  const a =
    data?.자치법규 ||
    data?.ordin ||
    data?.Ordin ||
    data?.list ||
    data?.items ||
    null;

  if (Array.isArray(a)) return a;

  const b =
    a?.자치법규 ||
    a?.ordin ||
    a?.Ordin ||
    a?.list ||
    a?.items ||
    null;

  if (Array.isArray(b)) return b;

  if (Array.isArray(data?.law)) return data.law;

  return [];
}

function normalizeOrdinItem(x) {
  const ordinId = String(
    x?.자치법규ID ??
      x?.ordinId ??
      x?.ID ??
      x?.id ??
      x?.MST ??
      x?.mst ??
      ""
  ).trim();

  const name = String(
    x?.자치법규명 ?? x?.ordinName ?? x?.명칭 ?? x?.name ?? x?.법규명 ?? ""
  ).trim();

  const orgName = String(
    x?.지자체기관명 ??
      x?.기관명 ??
      x?.orgName ??
      x?.자치법규기관명 ??
      x?.자치법규기관 ??
      ""
  ).trim();

  const link = String(
    x?.자치법규상세링크 ?? x?.link ?? x?.상세링크 ?? x?.법령상세링크 ?? ""
  ).trim();

  const kind = String(x?.자치법규종류 ?? x?.종류 ?? x?.kndName ?? x?.구분 ?? "").trim();
  const field = String(x?.자치법규분야명 ?? x?.분야명 ?? x?.fieldName ?? "").trim();
  const effDate = String(x?.시행일자 ?? x?.efYd ?? x?.effDate ?? "").trim();
  const annDate = String(x?.공포일자 ?? x?.ancYd ?? x?.annDate ?? "").trim();
  const annNo = String(x?.공포번호 ?? x?.ancNo ?? x?.annNo ?? "").trim();

  if (!ordinId || !name) return null;

  return {
    ordinId,
    name,
    orgName: orgName || null,
    kind: kind || null,
    field: field || null,
    effDate: effDate || null,
    annDate: annDate || null,
    annNo: annNo || null,
    link: link || null,
  };
}

export async function fetchOrdinList({
  oc,
  org,
  sborg = "",
  query = "주차",
  search = 1,
  knd = "30001",
  display = 100,
  page = 1,
  sort = "ddes",
  ordinFd = "",
}) {
  if (!oc) throw new Error("MISSING_OC");

  const url = buildUrl({
    OC: oc,
    target: "ordin",
    type: "JSON",
    ...(org ? { org } : {}),
    ...(sborg ? { sborg } : {}),
    knd,
    search,
    query,
    display,
    page,
    sort,
    ordinFd,
  });

  const raw = await fetchJson(url);
  const list = pickListAny(raw);
  const rows = list.map(normalizeOrdinItem).filter(Boolean);
  return { url, rows, raw };
}

// ----- orgMap scrape (가능하면, 실패하면 fallback) -----
let _orgMapCache = null;

function parseOrgMapFromHtml(html) {
  const map = new Map();
  const re =
    /<option\s+value\s*=\s*["']?(\d{4,})["']?\s*>\s*([^<]+?)\s*<\/option>/g;
  let m;
  while ((m = re.exec(html))) {
    const code = String(m[1] || "").trim();
    const name = cleanText(m[2] || "");
    if (code && name && SIDO_LIST.includes(name)) map.set(name, code);
  }
  return map;
}

export async function getOrgMapByScrape({ force = false } = {}) {
  if (_orgMapCache && !force) return _orgMapCache;
  try {
    const html = await fetchText(ORDIN_SEARCH_UI);
    const map = parseOrgMapFromHtml(html);
    _orgMapCache = map.size ? map : FALLBACK_ORG_MAP;
    return _orgMapCache;
  } catch {
    _orgMapCache = FALLBACK_ORG_MAP;
    return _orgMapCache;
  }
}

export async function resolveOrgBySido(sido) {
  const s = normalizeSido(sido);
  const map = await getOrgMapByScrape();
  const org = map.get(s) || "";
  if (!org) throw new Error(`ORG_NOT_FOUND_FOR_SIDO: ${s}`);
  return org;
}

// ----- DB helpers -----
function makeJurKey(sido, sigungu) {
  return `${sido}__${sigungu}`;
}

async function upsertJurisdiction(db, { jurKey, sido, sigungu }) {
  await db
    .prepare(
      `INSERT OR REPLACE INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .bind(jurKey, sido, sigungu)
    .run();
}

async function upsertOrdinIndexBatch(db, { jurKey, items }) {
  if (!items.length) return 0;

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
        String(it.ordinId),
        it.name,
        it.orgName,
        it.kind,
        it.field,
        it.effDate,
        it.annDate,
        it.annNo,
        it.link
      )
  );

  await db.batch(stmts);
  return items.length;
}

// ----- (2단계) ordinance text 저장 -----
function clampText(s, max = 200_000) {
  const x = String(s ?? "");
  return x.length > max ? x.slice(0, max) : x;
}

function extractTextByKeyHints(obj) {
  // 아주 보수적인 “키 힌트 기반” 텍스트 추출
  // body 후보: 조문/본문/내용/부칙
  // tables 후보: 별표/서식/표
  const bodyParts = [];
  const tableParts = [];

  const bodyKeyHit = (k) =>
    /조문|본문|내용|부칙|제\d+조|조\s*문/i.test(k);
  const tableKeyHit = (k) => /별표|서식|표|부록/i.test(k);

  const walk = (node, keyPath = "") => {
    if (node == null) return;
    if (typeof node === "string") {
      const k = keyPath.split(".").slice(-1)[0] || "";
      if (tableKeyHit(k)) tableParts.push(node);
      else if (bodyKeyHit(k)) bodyParts.push(node);
      return;
    }
    if (typeof node === "number" || typeof node === "boolean") return;

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], `${keyPath}[${i}]`);
      }
      return;
    }

    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        const next = keyPath ? `${keyPath}.${k}` : k;
        walk(v, next);
      }
    }
  };

  walk(obj, "");

  const norm = (arr) =>
    arr
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 2000) // 폭주 방지
      .join("\n");

  return {
    body_text: clampText(norm(bodyParts)),
    tables_text: clampText(norm(tableParts)),
  };
}

async function fetchOrdinanceJson({ oc, ordinId }) {
  const u = new URL(LAW_SERVICE_URL);
  u.searchParams.set("OC", String(oc));
  u.searchParams.set("target", "ordin");
  u.searchParams.set("type", "JSON");
  u.searchParams.set("MST", String(ordinId));

  const res = await fetchWithRetry(
    u.toString(),
    { headers: { accept: "application/json,text/plain,*/*" } },
    3
  );

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`ORDIN_TEXT_NOT_JSON: ${text.slice(0, 120)}`);
  }

  return { data, finalUrl: res.url };
}

async function upsertOrdinText(db, { jurKey, ordinId, name, sourceUrl, rawJson, bodyText, tablesText }) {
  await db
    .prepare(
      `INSERT OR REPLACE INTO parking_ordinance_text
       (ordin_id, jur_key, name, source_url, raw_json, body_text, tables_text, collected_at, updated_at)
       VALUES
       (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      String(ordinId),
      jurKey || null,
      name || null,
      sourceUrl || null,
      rawJson || null,
      bodyText || null,
      tablesText || null
    )
    .run();
}

// ----- (2.5단계) rules 저장 -----
async function loadOrdinanceTextRows(db, { jurKey, ordinIds }) {
  if (!ordinIds.length) return [];

  // D1 IN (?)는 placeholder 확장 이슈가 있어 안전하게 OR로 처리 (개수는 textSaveLimit로 제한됨)
  const stmts = ordinIds.map((id) =>
    db
      .prepare(
        `SELECT ordin_id, jur_key, name, source_url, body_text, tables_text, updated_at
         FROM parking_ordinance_text
         WHERE jur_key = ? AND ordin_id = ?
         LIMIT 1`
      )
      .bind(jurKey, String(id))
  );

  const out = [];
  for (const st of stmts) {
    const row = await st.first();
    if (row) out.push(row);
  }
  return out;
}

async function upsertParkingRulesBatch(db, rules) {
  if (!rules.length) return 0;

  const CHUNK = 80;
  let saved = 0;

  for (let i = 0; i < rules.length; i += CHUNK) {
    const part = rules.slice(i, i + CHUNK);
    const stmts = part.map((r) =>
      db
        .prepare(
          `INSERT OR REPLACE INTO parking_rules
           (jur_key, ordin_id, use_label, unit, value_num, note, source, collected_at, updated_at)
           VALUES
           (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          r.jur_key || null,
          r.ordin_id || null,
          r.use_label || null,
          r.unit || null,
          Number.isFinite(Number(r.value_num)) ? Number(r.value_num) : null,
          r.note || null,
          r.source || null
        )
    );

    await db.batch(stmts);
    saved += part.length;
  }

  return saved;
}

// ✅ 수집 + 필터 + (DB 적재) + (2단계) 본문 저장 + (2.5단계) 규칙 파싱/적재
export async function crawlParkingOrdinanceIndex({
  db,
  oc,
  sido,
  sigungu,
  query = "주차",
  searchMode = 1,
  limit = 30,
  throttleMs = 250,
  maxPages = 6,
  debug = false,

  // (전국모드 보호장치)
  maxSido = 17,

  // (2단계 보호장치)
  textSaveLimit = 20,
  textThrottleMs = 250,

  // (2.5단계 보호장치)
  parseRules = true,
  rulesParseLimit = 20,     // 보통 textSaveLimit과 맞추는 게 안전
}) {
  if (!oc) throw new Error("MISSING_OC");

  const sidoRaw = String(sido ?? "").trim();
  const sigunguRaw = String(sigungu ?? "").trim();

  const nationwide = isAllToken(sidoRaw);
  const sigunguAll = isAllToken(sigunguRaw);

  const s2 = sigunguAll ? "전체" : normalizeSigungu(sigunguRaw);
  if (!s2) throw new Error("MISSING_SIGUNGU");

  const targetSidos = nationwide
    ? SIDO_LIST.slice(0, Math.max(1, Math.min(maxSido, SIDO_LIST.length)))
    : [normalizeSido(sidoRaw)];

  if (!targetSidos[0]) {
    throw new Error(`ORG_NOT_FOUND_FOR_SIDO: ${sidoRaw || "(empty)"}`);
  }

  const jurKey = makeJurKey(nationwide ? "전국" : targetSidos[0], s2);

  const collected = [];
  const debugPack = debug ? { phases: [], rawHints: [] } : null;

  for (const s1 of targetSidos) {
    const org = await resolveOrgBySido(s1);

    let page = 1;
    while (page <= maxPages && collected.length < limit) {
      const r = await fetchOrdinList({
        oc,
        org,
        sborg: "",
        query,
        search: searchMode,
        display: 100,
        page,
        sort: "ddes",
      });

      const rows = r.rows || [];

      if (debug) {
        debugPack.phases.push({
          phase: nationwide ? "NATIONWIDE_SIDO" : "SINGLE_SIDO",
          sido: s1,
          org,
          page,
          url: r.url,
          rowsCount: rows.length,
          sampleOrgNames: rows.slice(0, 8).map((x) => x.orgName).filter(Boolean),
          sampleNames: rows.slice(0, 5).map((x) => x.name).filter(Boolean),
        });
        if (!rows.length) {
          const topKeys =
            r.raw && typeof r.raw === "object" ? Object.keys(r.raw).slice(0, 30) : [];
          debugPack.rawHints.push({
            sido: s1,
            page,
            topKeys,
            rawHead: safeJsonStringify(r.raw)?.slice(0, 500) || null,
          });
        }
      }

      if (!rows.length) break;

      for (const row of rows) {
        const orgName = row.orgName || "";

        if (sigunguAll) {
          collected.push({ sido: s1, sigungu: s2, org, sborg: null, ...row });
        } else {
          if (!orgName) continue;

          const hit =
            orgName.includes(s2) ||
            orgName.replace(/\s+/g, "").includes(s2.replace(/\s+/g, "")) ||
            orgName.includes(`${s1}${s2}`) ||
            orgName.includes(`${s1} ${s2}`) ||
            orgName.includes(`${s2}청`);

          if (hit) {
            collected.push({ sido: s1, sigungu: s2, org, sborg: null, ...row });
          }
        }

        if (collected.length >= limit) break;
      }

      page += 1;
      await sleep(throttleMs);
    }

    if (!nationwide) break;
    if (collected.length >= limit) break;
  }

  // 중복 제거
  const uniq = new Map();
  for (const it of collected) uniq.set(String(it.ordinId), it);
  const items = Array.from(uniq.values()).slice(0, limit);

  // ✅ 즉시 DB 적재 + 텍스트 저장 + 규칙 파싱/저장
  let savedIndex = 0;
  let savedText = 0;
  const textErrors = [];

  let savedRules = 0;
  const rulesErrors = [];

  if (db) {
    await upsertJurisdiction(db, {
      jurKey,
      sido: nationwide ? "전국" : targetSidos[0],
      sigungu: s2,
    });

    savedIndex = await upsertOrdinIndexBatch(db, { jurKey, items });

    // (2단계) 조례 본문 저장
    const toSaveText = items.slice(0, Math.max(0, Math.min(textSaveLimit, items.length)));
    for (const it of toSaveText) {
      try {
        const { data, finalUrl } = await fetchOrdinanceJson({ oc, ordinId: it.ordinId });
        const rawJson = safeJsonStringify(data);
        const { body_text, tables_text } = extractTextByKeyHints(data);

        await upsertOrdinText(db, {
          jurKey,
          ordinId: it.ordinId,
          name: it.name,
          sourceUrl: finalUrl,
          rawJson,
          bodyText: body_text,
          tablesText: tables_text,
        });

        savedText += 1;
      } catch (e) {
        textErrors.push({ ordinId: String(it.ordinId), error: String(e?.message || e) });
      }
      await sleep(textThrottleMs);
    }

    // (2.5단계) 저장된 본문 → 규칙 파싱 → parking_rules 적재
    if (parseRules) {
      const ordinIdsForParse = toSaveText
        .slice(0, Math.max(0, Math.min(rulesParseLimit, toSaveText.length)))
        .map((x) => x.ordinId);

      const textRows = await loadOrdinanceTextRows(db, {
        jurKey,
        ordinIds: ordinIdsForParse,
      });

      const allRules = [];
      for (const row of textRows) {
        try {
          const rules = parseParkingRulesFromOrdinanceTextRow(row) || [];
          for (const r of rules) allRules.push(r);
        } catch (e) {
          rulesErrors.push({
            ordinId: String(row?.ordin_id || ""),
            error: String(e?.message || e),
          });
        }
      }

      if (allRules.length) {
        savedRules = await upsertParkingRulesBatch(db, allRules);
      }
    }
  }

  return {
    ok: true,
    step: "COLLECT_SAVE_INDEX_TEXT_AND_RULES",
    input: {
      sido: nationwide ? "전국" : targetSidos[0],
      sigungu: s2,
      limit,
      query,
      nationwide,
      sigunguAll,
      parseRules,
    },
    jurKey,
    collected: items.length,
    saved: {
      index_rows: savedIndex,
      text_rows: savedText,
      text_errors: textErrors.slice(0, 10),
      rules_rows: savedRules,
      rules_errors: rulesErrors.slice(0, 10),
    },
    sample: items.slice(0, Math.min(5, items.length)),
    debug: debug ? debugPack : undefined,
  };
}

// ✅ API entry
export async function run({ db, oc, sido, sigungu, limit = 30, debug = false, query = "주차" }) {
  return crawlParkingOrdinanceIndex({ db, oc, sido, sigungu, limit, debug, query });
}

export default run;