// src/crawler/parkingCrawler.js (FULL REPLACE)
//
// ✅ 목표(즉시 실행 가능한 실수집+저장 1단계):
// - ordinSc.do HTML 스크랩이 막히거나(동적 렌더링) 구조가 바뀌어도,
//   시도(org) 코드를 fallback 맵으로 해결해서 "바로 수집"을 계속한다.
// - sborg 없이 org(시도) 단위 검색 → orgName에 sigungu 포함된 것만 필터
// - D1에 저장(인덱스 + 원문(raw_json) 일부)
//
// ⚠️ 다음 단계(정석):
// - 시군구 목록/기관코드(sbrog) 동적 수집 + 캐시

import { SIDO_LIST, cleanText, normalizeSido, normalizeSigungu } from "./cityList.js";

const DRF_BASE = "https://www.law.go.kr/DRF/lawSearch.do";
const LAW_SERVICE_URL = "https://www.law.go.kr/DRF/lawService.do";
const ORDIN_SEARCH_UI = "https://www.law.go.kr/ordinSc.do";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonStringify(x) {
  try { return JSON.stringify(x); } catch { return null; }
}

// ✅ fallback: 시도(org) 코드 (스크랩 실패 시 즉시 사용)
// ※ 만약 특정 시도가 0건이면 해당 org 코드가 다른 값일 수 있으니,
//   그 시도만 별도로 확인/수정하면 됨.
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

async function fetchWithRetry(url, opts = {}, retry = 3) {
  let lastErr = null;
  for (let i = 0; i <= retry; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent": "archi-law-crawler/1.0",
          ...(opts.headers || {}),
        },
        ...opts,
      });

      if (!res.ok) {
        const status = res.status;
        const text = await res.text().catch(() => "");
        const msg = `HTTP_${status}: ${text.slice(0, 200)}`;

        const retryable =
          status === 408 || status === 425 || status === 429 ||
          status === 500 || status === 502 || status === 503 || status === 504 ||
          status === 520 || status === 522 || status === 523 || status === 524 || status === 525;

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
  const res = await fetchWithRetry(
    url,
    { headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } },
    3
  );
  return await res.text();
}

async function fetchJson(url) {
  const res = await fetchWithRetry(
    url,
    { headers: { accept: "application/json,text/plain,*/*" } },
    3
  );
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`NOT_JSON: ${text.slice(0, 120)}`); }
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

function pickListAny(root) {
  if (!root) return [];
  if (Array.isArray(root)) return root;

  const a = root?.자치법규 || root?.ordin || root?.Ordin || root?.list || root?.items || null;
  if (Array.isArray(a)) return a;

  const b = a?.자치법규 || a?.ordin || a?.Ordin || a?.list || a?.items || null;
  return Array.isArray(b) ? b : [];
}

function normalizeOrdinItem(x) {
  const ordinId = String(x?.자치법규ID ?? x?.ordinId ?? x?.ID ?? x?.id ?? "").trim();
  const name = String(x?.자치법규명 ?? x?.ordinName ?? x?.명칭 ?? x?.name ?? "").trim();
  const link = String(x?.자치법규상세링크 ?? x?.link ?? x?.상세링크 ?? "").trim();
  const orgName = String(x?.지자체기관명 ?? x?.기관명 ?? x?.orgName ?? "").trim();
  const kind = String(x?.자치법규종류 ?? x?.종류 ?? x?.kndName ?? "").trim();
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

// ---------------------------------------------------------
// ✅ 목록 조회 (org 필수, sborg 선택)
// ---------------------------------------------------------
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
  if (!org) throw new Error("MISSING_ORG");

  const url = buildUrl({
    OC: oc,
    target: "ordin",
    type: "JSON",
    org,
    sborg,
    knd,
    search,
    query,
    display,
    page,
    sort,
    ordinFd,
  });

  const data = await fetchJson(url);
  const list = pickListAny(data?.자치법규) || pickListAny(data);
  const rows = list.map(normalizeOrdinItem).filter(Boolean);
  return { url, rows, raw: data };
}

// ---------------------------------------------------------
// ✅ orgMap 스크랩(시도 코드) — 실패하면 fallback 사용
// ---------------------------------------------------------
let _orgMapCache = null;

function parseOrgMapFromHtml(html) {
  const map = new Map();
  const re = /<option\s+value\s*=\s*["']?(\d{4,})["']?\s*>\s*([^<]+?)\s*<\/option>/g;
  let m;
  while ((m = re.exec(html))) {
    const code = String(m[1] || "").trim();
    const name = cleanText(m[2] || "");
    if (code && name && SIDO_LIST.includes(name)) {
      map.set(name, code);
    }
  }
  return map;
}

export async function getOrgMapByScrape({ force = false } = {}) {
  if (_orgMapCache && !force) return _orgMapCache;

  try {
    const html = await fetchText(ORDIN_SEARCH_UI);
    const map = parseOrgMapFromHtml(html);
    if (map.size) {
      _orgMapCache = map;
      return map;
    }
    // 스크랩 실패 → fallback
    _orgMapCache = FALLBACK_ORG_MAP;
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

// ---------------------------------------------------------
// ✅ 원문(JSON) 조회: lawService.do?target=ordin&MST=...
// ---------------------------------------------------------
export async function fetchOrdinanceText({ oc, mst }) {
  if (!oc) throw new Error("MISSING_OC");
  if (!mst) throw new Error("MISSING_MST");

  const u = new URL(LAW_SERVICE_URL);
  u.searchParams.set("OC", oc);
  u.searchParams.set("target", "ordin");
  u.searchParams.set("MST", String(mst));
  u.searchParams.set("type", "JSON");

  const data = await fetchJson(u.toString());
  return { finalUrl: u.toString(), data };
}

function tryExtractBodyTextFromOrdinJson(data) {
  const root = data?.자치법규 || data?.ordin || data?.Ordin || data;
  const body =
    root?.본문 || root?.내용 || root?.body || root?.text || root?.자치법규내용 || null;
  if (typeof body === "string" && body.trim()) return body.trim();
  return null;
}

// ---------------------------------------------------------
// ✅ (실수집) org-only + sigungu 포함 필터
// ---------------------------------------------------------
export async function crawlParkingOrdinanceIndex({
  oc,
  sido,
  sigungu,
  query = "주차",
  searchMode = 1,
  limit = 30,
  throttleMs = 200,
  maxPages = 10,
  debug = false,
}) {
  if (!oc) throw new Error("MISSING_OC");
  const s1 = normalizeSido(sido);
  const s2 = normalizeSigungu(sigungu);
  if (!s1) throw new Error("MISSING_SIDO");
  if (!s2) throw new Error("MISSING_SIGUNGU");

  const org = await resolveOrgBySido(s1);

  const collected = [];
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
    if (!rows.length) break;

    for (const row of rows) {
      const orgName = row.orgName || "";
      if (orgName.includes(s2)) {
        collected.push({ sido: s1, sigungu: s2, org, sborg: null, ...row });
        if (collected.length >= limit) break;
      }
    }

    page += 1;
    await sleep(throttleMs);
  }

  const uniq = new Map();
  for (const it of collected) {
    const key = String(it.ordinId);
    if (!uniq.has(key)) uniq.set(key, it);
  }

  const items = Array.from(uniq.values()).slice(0, limit);

  return {
    ok: true,
    mode: "ORG_ONLY_FILTER_BY_SIGUNGU",
    input: { sido: s1, sigungu: s2, query, limit },
    resolved: {
      org,
      sborg: null,
      orgMapSource: (_orgMapCache === FALLBACK_ORG_MAP) ? "FALLBACK" : "SCRAPED",
    },
    collected: items.length,
    items,
    debug: debug ? { pagesTried: page - 1, maxPages, throttleMs } : undefined,
  };
}

// ---------------------------------------------------------
// ✅ D1 저장(Upsert)
// ---------------------------------------------------------
function makeJurKey(sido, sigungu) {
  return `${sido}__${sigungu}`;
}

async function upsertJurisdiction(db, { sido, sigungu }) {
  const jurKey = makeJurKey(sido, sigungu);

  await db.prepare(`
      INSERT INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(jur_key) DO UPDATE SET
        sido=excluded.sido,
        sigungu=excluded.sigungu,
        updated_at=datetime('now')
    `)
    .bind(jurKey, sido, sigungu)
    .run();

  return jurKey;
}

async function upsertIndexRows(db, jurKey, items) {
  if (!items.length) return 0;

  const stmts = items.map((it) =>
    db.prepare(`
        INSERT INTO parking_ordinance_index
          (jur_key, ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link, collected_at, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(jur_key, ordin_id) DO UPDATE SET
          name=excluded.name,
          org_name=excluded.org_name,
          kind=excluded.kind,
          field=excluded.field,
          eff_date=excluded.eff_date,
          ann_date=excluded.ann_date,
          ann_no=excluded.ann_no,
          link=excluded.link,
          updated_at=datetime('now')
      `)
      .bind(
        jurKey,
        String(it.ordinId),
        String(it.name),
        it.orgName || null,
        it.kind || null,
        it.field || null,
        it.effDate || null,
        it.annDate || null,
        it.annNo || null,
        it.link || null
      )
  );

  await db.batch(stmts);
  return items.length;
}

async function upsertOrdinanceTextRaw(db, jurKey, { ordinId, name, sourceUrl, rawJson, bodyText, tablesText }) {
  await db.prepare(`
      INSERT INTO parking_ordinance_text
        (ordin_id, jur_key, name, source_url, raw_json, body_text, tables_text, collected_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(ordin_id) DO UPDATE SET
        jur_key=excluded.jur_key,
        name=excluded.name,
        source_url=excluded.source_url,
        raw_json=excluded.raw_json,
        body_text=excluded.body_text,
        tables_text=excluded.tables_text,
        updated_at=datetime('now')
    `)
    .bind(
      String(ordinId),
      jurKey,
      name || null,
      sourceUrl || null,
      rawJson || null,
      bodyText || null,
      tablesText || null
    )
    .run();
}

// ---------------------------------------------------------
// ✅ API가 기대하는 "수집+저장" 실행 함수
// ---------------------------------------------------------
export async function runParkingCrawler({
  db,
  oc,
  sido,
  sigungu,
  limit = 30,
  debug = false,
  query = "주차",
  saveTextTopN = 3,
}) {
  if (!db) throw new Error("MISSING_DB");
  if (!oc) throw new Error("MISSING_OC");

  const s1 = normalizeSido(sido);
  const s2 = normalizeSigungu(sigungu);
  if (!s1) throw new Error("MISSING_SIDO");
  if (!s2) throw new Error("MISSING_SIGUNGU");

  const index = await crawlParkingOrdinanceIndex({ oc, sido: s1, sigungu: s2, limit, debug, query });

  const jurKey = await upsertJurisdiction(db, { sido: s1, sigungu: s2 });
  const savedIndex = await upsertIndexRows(db, jurKey, index.items || []);

  const picked = (index.items || []).slice(0, Math.max(0, saveTextTopN));
  let savedText = 0;
  const textErrors = [];

  for (const it of picked) {
    try {
      const { data } = await fetchOrdinanceText({ oc, mst: it.ordinId });
      const rawJson = safeJsonStringify(data);
      const bodyText = tryExtractBodyTextFromOrdinJson(data);

      await upsertOrdinanceTextRaw(db, jurKey, {
        ordinId: it.ordinId,
        name: it.name,
        sourceUrl: it.link || null,
        rawJson,
        bodyText,
        tablesText: null,
      });
      savedText += 1;
      await sleep(120);
    } catch (e) {
      textErrors.push({ ordinId: it.ordinId, error: String(e?.message || e) });
      await sleep(120);
    }
  }

  return {
    ok: true,
    step: "COLLECT_AND_SAVE_INDEX(+OPTIONAL_RAW_TEXT)",
    input: { sido: s1, sigungu: s2, limit, query },
    jurKey,
    resolved: index.resolved,
    collected: index.collected,
    saved: { index_rows: savedIndex, text_rows: savedText },
    sample: (index.items || []).slice(0, 5),
    debug: debug ? { textErrors } : undefined,
  };
}

// alias
export async function run({ db, oc, sido, sigungu, limit = 30, debug = false }) {
  return runParkingCrawler({ db, oc, sido, sigungu, limit, debug });
}

export default runParkingCrawler;