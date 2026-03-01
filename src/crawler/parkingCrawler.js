// src/crawler/parkingCrawler.js (FULL REPLACE)
// 디버그 강화 버전: collected=0 원인 확정용

import { SIDO_LIST, cleanText, normalizeSido, normalizeSigungu } from "./cityList.js";

const DRF_BASE = "https://www.law.go.kr/DRF/lawSearch.do";
const LAW_SERVICE_URL = "https://www.law.go.kr/DRF/lawService.do";
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

  return { ordinId, name, orgName: orgName || null, kind: kind || null, field: field || null,
    effDate: effDate || null, annDate: annDate || null, annNo: annNo || null, link: link || null };
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

// ✅ 핵심: collected=0 원인 확정용 디버그를 반환
export async function crawlParkingOrdinanceIndex({
  oc,
  sido,
  sigungu,
  query = "주차",
  searchMode = 1,
  limit = 30,
  throttleMs = 200,
  maxPages = 3,
  debug = false,
}) {
  if (!oc) throw new Error("MISSING_OC");
  const s1 = normalizeSido(sido);
  const s2 = normalizeSigungu(sigungu);
  if (!s1) throw new Error("MISSING_SIDO");
  if (!s2) throw new Error("MISSING_SIGUNGU");

  const org = await resolveOrgBySido(s1);

  const collected = [];
  const debugPack = debug ? { tried: [], rawHints: [] } : null;

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
      // rows가 0이면 raw 구조 힌트 남기기
      const topKeys = r.raw && typeof r.raw === "object" ? Object.keys(r.raw).slice(0, 30) : [];
      debugPack.tried.push({
        page,
        url: r.url,
        rowsCount: rows.length,
        sampleOrgNames: rows.slice(0, 5).map(x => x.orgName).filter(Boolean),
      });

      if (!rows.length) {
        debugPack.rawHints.push({
          page,
          topKeys,
          rawHead: safeJsonStringify(r.raw)?.slice(0, 400) || null,
        });
      }
    }

    if (!rows.length) break;

    // ✅ 필터 전에 1차로 rows를 보여줘야 원인 확정 가능
    for (const row of rows) {
      const orgName = row.orgName || "";
      if (!orgName) continue;

      // 기존: orgName.includes(s2)
      // ✅ 디버그 상황에서 표기 차이(성동구청/서울특별시 성동구 등)를 위해 완화:
      const hit =
        orgName.includes(s2) ||
        orgName.replace(/\s+/g, "").includes(s2.replace(/\s+/g, "")) ||
        orgName.includes(`${s1} ${s2}`) ||
        orgName.includes(`${s2}청`);

      if (hit) {
        collected.push({ sido: s1, sigungu: s2, org, sborg: null, ...row });
        if (collected.length >= limit) break;
      }
    }

    page += 1;
    await sleep(throttleMs);
  }

  const uniq = new Map();
  for (const it of collected) uniq.set(String(it.ordinId), it);
  const items = Array.from(uniq.values()).slice(0, limit);

  return {
    ok: true,
    mode: "ORG_ONLY_FILTER_BY_SIGUNGU",
    input: { sido: s1, sigungu: s2, query, limit },
    resolved: { org, sborg: null, orgMapSource: (_orgMapCache === FALLBACK_ORG_MAP) ? "FALLBACK" : "SCRAPED" },
    collected: items.length,
    items,
    debug: debug ? debugPack : undefined,
  };
}

// ✅ API 호환
export async function run({ db, oc, sido, sigungu, limit = 30, debug = false, query = "주차" }) {
  // 저장은 기존 버전 유지한다고 가정하고 "index만" 반환
  // (고미 프로젝트에서는 runParkingCrawler가 따로 있으니, 여기서는 index만 충분)
  return crawlParkingOrdinanceIndex({ oc, sido, sigungu, limit, debug, query });
}

export default run;