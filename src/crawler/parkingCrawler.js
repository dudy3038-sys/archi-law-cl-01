// src/crawler/parkingCrawler.js (FULL REPLACE)
// collected=0 탈출 + "실제 DB 쌓기" 버전
//
// 핵심:
// 1) 1차: org(시도)만으로 빠르게 검색
// 2) 2차: 0건이면 org를 아예 빼고(전국 검색) sigungu로 필터해서 수집
// 3) db가 주어지면 parking_jurisdiction / parking_ordinance_index에 즉시 upsert
//
// 주의:
// - DRF 구조가 변할 수 있어 debug에 url/rowsCount/sampleOrgNames를 남김
// - 다음 단계에서 sborg 동적수집 붙이면 1차에서 대부분 해결됨

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

/**
 * ✅ DRF ordin list
 * - org는 "있으면 좁게", 없으면(빈 문자열/undefined) 전국검색 시도
 * - 일부 환경에서 org 없이 에러날 수 있으니 상위에서 catch하여 다른 전략으로 넘어가게 함
 */
export async function fetchOrdinList({
  oc,
  org,               // optional
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
    // ✅ org가 falsy면 아예 파라미터를 넣지 않음(전국검색 시도)
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

function orgNameHit({ orgName, s1, s2 }) {
  if (!orgName) return false;
  const a = orgName;
  const b = a.replace(/\s+/g, "");
  const s2c = s2.replace(/\s+/g, "");
  return (
    a.includes(s2) ||
    b.includes(s2c) ||
    a.includes(`${s1} ${s2}`) ||
    a.includes(`${s2}청`)
  );
}

function makeJurKey(sido, sigungu) {
  return `${String(sido).trim()}__${String(sigungu).trim()}`;
}

/**
 * ✅ DB upsert helpers (D1)
 */
async function upsertJurisdiction(db, { jurKey, sido, sigungu }) {
  await db.prepare(
    `
    INSERT INTO parking_jurisdiction (jur_key, sido, sigungu, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(jur_key) DO UPDATE SET
      sido=excluded.sido,
      sigungu=excluded.sigungu,
      updated_at=datetime('now')
    `
  ).bind(jurKey, sido, sigungu).run();
}

async function upsertIndexRows(db, jurKey, items) {
  if (!items.length) return 0;

  const stmts = items.map((it) =>
    db.prepare(
      `
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
      `
    ).bind(
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

/**
 * ✅ collected=0 원인 확정 + fallback 수집 + 즉시 DB 적재
 */
export async function crawlParkingOrdinanceIndex({
  db = null,          // ✅ D1 (있으면 저장)
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

  const debugPack = debug ? { phases: [], rawHints: [] } : null;

  // -----------------------------
  // Phase A: org-only (fast)
  // -----------------------------
  let org = "";
  try {
    org = await resolveOrgBySido(s1);
  } catch {
    org = "";
  }

  async function collectPhase({ phase, orgParam }) {
    const collected = [];
    let page = 1;

    while (page <= maxPages && collected.length < limit) {
      const r = await fetchOrdinList({
        oc,
        org: orgParam || undefined,
        sborg: "",
        query,
        search: searchMode,
        display: 100,
        page,
        sort: "ddes",
      });

      const rows = r.rows || [];

      if (debug) {
        const topKeys = r.raw && typeof r.raw === "object" ? Object.keys(r.raw).slice(0, 30) : [];
        debugPack.phases.push({
          phase,
          page,
          url: r.url,
          rowsCount: rows.length,
          sampleOrgNames: rows.slice(0, 8).map(x => x.orgName).filter(Boolean),
        });

        if (!rows.length) {
          debugPack.rawHints.push({
            phase,
            page,
            topKeys,
            rawHead: safeJsonStringify(r.raw)?.slice(0, 400) || null,
          });
        }
      }

      if (!rows.length) break;

      for (const row of rows) {
        if (orgNameHit({ orgName: row.orgName || "", s1, s2 })) {
          collected.push({ sido: s1, sigungu: s2, org: orgParam || null, sborg: null, ...row });
          if (collected.length >= limit) break;
        }
      }

      page += 1;
      await sleep(throttleMs);
    }

    const uniq = new Map();
    for (const it of collected) uniq.set(String(it.ordinId), it);
    return Array.from(uniq.values()).slice(0, limit);
  }

  let items = [];
  let mode = "";
  let orgMapSource = (_orgMapCache === FALLBACK_ORG_MAP) ? "FALLBACK" : "SCRAPED";

  // A-1) org-only
  if (org) {
    items = await collectPhase({ phase: "A:ORG_ONLY", orgParam: org });
    mode = "ORG_ONLY_FILTER_BY_SIGUNGU";
  }

  // A-2) fallback: nationwide (org param omitted)
  if (!items.length) {
    try {
      const nationwide = await collectPhase({ phase: "B:NATIONWIDE_NO_ORG", orgParam: "" });
      items = nationwide;
      mode = "NATIONWIDE_FILTER_BY_SIGUNGU";
    } catch (e) {
      // 전국검색 자체가 막히면 여기서 에러를 그대로 노출(원인 파악이 쉬움)
      throw new Error(`NATIONWIDE_SEARCH_FAILED: ${String(e?.message || e)}`);
    }
  }

  // ✅ DB 저장(쌓기)
  let saved = { index_rows: 0 };
  const jurKey = makeJurKey(s1, s2);

  if (db) {
    await upsertJurisdiction(db, { jurKey, sido: s1, sigungu: s2 });
    if (items.length) {
      saved.index_rows = await upsertIndexRows(db, jurKey, items);
    }
  }

  return {
    ok: true,
    step: "COLLECT_AND_SAVE_INDEX",
    input: { sido: s1, sigungu: s2, limit, query },
    jurKey,
    resolved: { org: org || null, sborg: null, orgMapSource },
    mode,
    collected: items.length,
    saved,
    sample: items.slice(0, 5),
    debug: debug ? debugPack : undefined,
  };
}

/**
 * ✅ API 호환 (functions/api에서 fn({db,oc,...}) 형태로 호출)
 */
export async function run({ db, oc, sido, sigungu, limit = 30, debug = false, query = "주차" }) {
  return crawlParkingOrdinanceIndex({ db, oc, sido, sigungu, limit, debug, query });
}

export default run;