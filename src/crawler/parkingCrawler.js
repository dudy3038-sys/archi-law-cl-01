// src/crawler/parkingCrawler.js (FULL REPLACE)
// ✅ 실수집 + 즉시 DB 적재 버전
//
// 핵심 수정:
// 1) DRF 자치법규 검색 응답이 { OrdinSearch: { law: [...] } } 형태로 올 수 있어
//    pickListAny가 OrdinSearch.law 를 반드시 읽도록 보강
// 2) run({ db, oc, sido, sigungu, ... })에서
//    parking_jurisdiction / parking_ordinance_index에 즉시 upsert 해서 DB를 "쌓는" 방식으로 진행
// 3) debug 시 rowsCount=0 원인(파싱/응답구조)을 바로 확인할 수 있게 rawHints 유지

import { SIDO_LIST, cleanText, normalizeSido, normalizeSigungu } from "./cityList.js";

const DRF_BASE = "https://www.law.go.kr/DRF/lawSearch.do";
const ORDIN_SEARCH_UI = "https://www.law.go.kr/ordinSc.do";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function safeJsonStringify(x) { try { return JSON.stringify(x); } catch { return null; } }

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
        headers: { "user-agent": "archi-law-crawler/1.0", ...(opts.headers || {}) },
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
  const res = await fetchWithRetry(url, { headers: { accept: "text/html,*/*" } }, 3);
  return await res.text();
}

async function fetchJson(url) {
  const res = await fetchWithRetry(url, { headers: { accept: "application/json,text/plain,*/*" } }, 3);
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

/**
 * ✅ DRF ordin 검색 결과가 다음 형태로 올 수 있음
 * - { OrdinSearch: { law: [...] } }
 * - { ordinSearch: { law: [...] } }
 * - { 자치법규: { 자치법규: [...] } } 등
 */
function pickListAny(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  // 1) 가장 흔한 케이스: OrdinSearch.law
  const os = data?.OrdinSearch || data?.ordinSearch || data?.ORDINSEARCH;
  const osLaw = os?.law || os?.Law || os?.list || os?.items;
  if (Array.isArray(osLaw)) return osLaw;

  // 2) 기존 케이스들
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

  // 3) 혹시 law가 바로 최상위에 오는 케이스
  if (Array.isArray(data?.law)) return data.law;

  return [];
}

function normalizeOrdinItem(x) {
  const ordinId = String(x?.자치법규ID ?? x?.ordinId ?? x?.ID ?? x?.id ?? x?.MST ?? x?.mst ?? "").trim();
  const name = String(x?.자치법규명 ?? x?.ordinName ?? x?.명칭 ?? x?.name ?? x?.법규명 ?? "").trim();

  // 기관명은 다양한 키로 올 수 있음
  const orgName = String(
    x?.지자체기관명 ??
    x?.기관명 ??
    x?.orgName ??
    x?.자치법규기관명 ??
    x?.자치법규기관 ??
    ""
  ).trim();

  const link = String(x?.자치법규상세링크 ?? x?.link ?? x?.상세링크 ?? x?.법령상세링크 ?? "").trim();

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
    // ✅ org/sborg는 선택적으로만
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
  const re = /<option\s+value\s*=\s*["']?(\d{4,})["']?\s*>\s*([^<]+?)\s*<\/option>/g;
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
  // schema.sql 예시가 "__"라서 그대로 사용
  return `${sido}__${sigungu}`;
}

async function upsertJurisdiction(db, { jurKey, sido, sigungu }) {
  await db.prepare(
    `INSERT OR REPLACE INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).bind(jurKey, sido, sigungu).run();
}

async function upsertOrdinIndexBatch(db, { jurKey, items }) {
  if (!items.length) return 0;

  const stmts = items.map((it) =>
    db.prepare(
      `INSERT OR REPLACE INTO parking_ordinance_index
       (jur_key, ordin_id, name, org_name, kind, field, eff_date, ann_date, ann_no, link, collected_at, updated_at)
       VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
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

// ✅ 수집 + 필터 + (DB 적재)
export async function crawlParkingOrdinanceIndex({
  db,
  oc,
  sido,
  sigungu,
  query = "주차",
  searchMode = 1,
  limit = 30,
  throttleMs = 200,
  maxPages = 6,
  debug = false,
}) {
  if (!oc) throw new Error("MISSING_OC");
  const s1 = normalizeSido(sido);
  const s2 = normalizeSigungu(sigungu);
  if (!s1) throw new Error("MISSING_SIDO");
  if (!s2) throw new Error("MISSING_SIGUNGU");

  const org = await resolveOrgBySido(s1);
  const jurKey = makeJurKey(s1, s2);

  const collected = [];
  const debugPack = debug ? { tried: [], rawHints: [] } : null;

  let page = 1;
  while (page <= maxPages && collected.length < limit) {
    const r = await fetchOrdinList({
      oc,
      org,
      sborg: "",          // 시도 단위
      query,
      search: searchMode,
      display: 100,
      page,
      sort: "ddes",
    });

    const rows = r.rows || [];

    if (debug) {
      const topKeys = r.raw && typeof r.raw === "object" ? Object.keys(r.raw).slice(0, 30) : [];
      debugPack.tried.push({
        page,
        url: r.url,
        rowsCount: rows.length,
        sampleOrgNames: rows.slice(0, 10).map(x => x.orgName).filter(Boolean),
        sampleNames: rows.slice(0, 5).map(x => x.name).filter(Boolean),
      });

      if (!rows.length) {
        debugPack.rawHints.push({
          page,
          topKeys,
          rawHead: safeJsonStringify(r.raw)?.slice(0, 500) || null,
        });
      }
    }

    if (!rows.length) break;

    for (const row of rows) {
      const orgName = row.orgName || "";
      if (!orgName) continue;

      // 표기 흔들림 대응
      const hit =
        orgName.includes(s2) ||
        orgName.replace(/\s+/g, "").includes(s2.replace(/\s+/g, "")) ||
        orgName.includes(`${s1}${s2}`) ||
        orgName.includes(`${s1} ${s2}`) ||
        orgName.includes(`${s2}청`);

      if (hit) {
        collected.push({
          sido: s1,
          sigungu: s2,
          org,
          sborg: null,
          ...row,
        });
        if (collected.length >= limit) break;
      }
    }

    page += 1;
    await sleep(throttleMs);
  }

  // 중복 제거
  const uniq = new Map();
  for (const it of collected) uniq.set(String(it.ordinId), it);
  const items = Array.from(uniq.values()).slice(0, limit);

  // ✅ 즉시 DB 적재(허수 테스트 낭비 줄이기)
  let savedIndex = 0;
  if (db) {
    await upsertJurisdiction(db, { jurKey, sido: s1, sigungu: s2 });
    savedIndex = await upsertOrdinIndexBatch(db, { jurKey, items });
  }

  return {
    ok: true,
    step: "COLLECT_AND_SAVE_INDEX",
    input: { sido: s1, sigungu: s2, limit, query },
    jurKey,
    resolved: { org, sborg: null, orgMapSource: (_orgMapCache === FALLBACK_ORG_MAP) ? "FALLBACK" : "SCRAPED" },
    collected: items.length,
    saved: { index_rows: savedIndex },
    sample: items.slice(0, Math.min(5, items.length)),
    debug: debug ? debugPack : undefined,
  };
}

// ✅ API에서 바로 호출되는 entry
export async function run({ db, oc, sido, sigungu, limit = 30, debug = false, query = "주차" }) {
  return crawlParkingOrdinanceIndex({ db, oc, sido, sigungu, limit, debug, query });
}

export default run;