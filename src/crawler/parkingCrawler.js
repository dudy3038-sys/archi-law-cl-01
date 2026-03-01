// src/crawler/parkingCrawler.js (FULL REPLACE)
//
// ✅ 목표(즉시 실행 가능한 실수집 1단계):
// - org/sborg(기관코드) "완전 동적 수집" 전이라도,
//   1) law.go.kr 자치법규 검색 페이지 HTML에서 '시도(org)' 코드 목록을 파싱
//   2) sborg 없이 org 단위로 DRF 자치법규 목록을 조회
//   3) 결과의 '지자체기관명(orgName)'에 시군구 문자열이 포함된 것만 필터
// -> 이렇게 하면 "서울특별시/성동구" 같은 입력으로도 당장 실데이터 수집이 가능함.
//
// ⚠️ 다음 단계(정석):
// - 시군구 옵션 목록/기관코드(sbrog) 동적 수집까지 붙이면 정확도/성능이 크게 좋아짐.

import {
  SIDO_LIST,
  cleanText,
  normalizeSido,
  normalizeSigungu,
} from "./cityList.js";

// DRF 자치법규 검색
const DRF_BASE = "http://www.law.go.kr/DRF/lawSearch.do";
// DRF 본문 조회(자치법규도 lawService.do + target=ordin로 조회 가능)
const LAW_SERVICE_URL = "http://www.law.go.kr/DRF/lawService.do";

// law.go.kr 자치법규 검색 UI (org 코드 파싱용)
const ORDIN_SEARCH_UI = "https://www.law.go.kr/ordinSc.do";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-crawler/1.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP_${res.status}: ${text.slice(0, 200)}`);
  return text;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-crawler/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP_${res.status}: ${text.slice(0, 200)}`);
  }
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

function pickListAny(root) {
  if (!root) return [];
  if (Array.isArray(root)) return root;

  const a =
    root?.자치법규 ||
    root?.ordin ||
    root?.Ordin ||
    root?.list ||
    root?.items ||
    null;

  if (Array.isArray(a)) return a;

  const b =
    a?.자치법규 ||
    a?.ordin ||
    a?.Ordin ||
    a?.list ||
    a?.items ||
    null;

  return Array.isArray(b) ? b : [];
}

function normalizeOrdinItem(x) {
  const ordinId =
    String(x?.자치법규ID ?? x?.ordinId ?? x?.ID ?? x?.id ?? "").trim();
  const name =
    String(x?.자치법규명 ?? x?.ordinName ?? x?.명칭 ?? x?.name ?? "").trim();
  const link =
    String(x?.자치법규상세링크 ?? x?.link ?? x?.상세링크 ?? "").trim();
  const orgName =
    String(x?.지자체기관명 ?? x?.기관명 ?? x?.orgName ?? "").trim();
  const kind =
    String(x?.자치법규종류 ?? x?.종류 ?? x?.kndName ?? "").trim();
  const field =
    String(x?.자치법규분야명 ?? x?.분야명 ?? x?.fieldName ?? "").trim();
  const effDate =
    String(x?.시행일자 ?? x?.efYd ?? x?.effDate ?? "").trim();
  const annDate =
    String(x?.공포일자 ?? x?.ancYd ?? x?.annDate ?? "").trim();
  const annNo =
    String(x?.공포번호 ?? x?.ancNo ?? x?.annNo ?? "").trim();

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
// ✅ 자치법규 목록 조회 (org는 필수, sborg는 선택)
// ---------------------------------------------------------
export async function fetchOrdinList({
  oc,
  org,
  sborg = "", // ✅ 없어도 됨(시도 단위 검색)
  query = "주차",
  search = 1, // 1: 자치법규명, 2: 본문검색
  knd = "30001", // 조례
  display = 100,
  page = 1,
  sort = "ddes", // 공포일자 내림차순
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
// ✅ 시도(org) 코드 파싱
// - law.go.kr 자치법규 검색 페이지 HTML에서 option을 파싱해 orgMap 생성
// - 예: { "서울특별시": "6110000", ... }
// ---------------------------------------------------------
let _orgMapCache = null;

function parseOrgMapFromHtml(html) {
  // 여러 형태를 최대한 넓게 커버: value=숫자 + 텍스트=시도명
  // (페이지 구조가 바뀔 수 있어 보수적으로)
  const map = new Map();

  // option value="6110000">서울특별시</option> 같은 패턴
  const re = /<option\s+value\s*=\s*["']?(\d{4,})["']?\s*>\s*([^<]+?)\s*<\/option>/g;
  let m;
  while ((m = re.exec(html))) {
    const code = String(m[1] || "").trim();
    const name = cleanText(m[2] || "");
    // 시도만 골라 담기: SIDO_LIST와 매칭되는 것만
    if (code && name && SIDO_LIST.includes(name)) {
      map.set(name, code);
    }
  }
  return map;
}

export async function getOrgMapByScrape({ force = false } = {}) {
  if (_orgMapCache && !force) return _orgMapCache;
  const html = await fetchText(ORDIN_SEARCH_UI);
  const map = parseOrgMapFromHtml(html);

  if (!map.size) {
    throw new Error("ORG_MAP_PARSE_FAILED: cannot find sido->org codes from ordinSc.do");
  }
  _orgMapCache = map;
  return map;
}

export async function resolveOrgBySido(sido) {
  const s = normalizeSido(sido);
  const map = await getOrgMapByScrape();
  const org = map.get(s) || "";
  if (!org) throw new Error(`ORG_NOT_FOUND_FOR_SIDO: ${s}`);
  return org;
}

// ---------------------------------------------------------
// ✅ 자치법규 본문(JSON/HTML) 조회 (조례 텍스트/별표 수집 시작점)
// - lawService.do?OC=...&target=ordin&MST=...&type=JSON
// ---------------------------------------------------------
export async function fetchOrdinanceText({ oc, mst, type = "JSON" }) {
  if (!oc) throw new Error("MISSING_OC");
  if (!mst) throw new Error("MISSING_MST");

  const u = new URL(LAW_SERVICE_URL);
  u.searchParams.set("OC", oc);
  u.searchParams.set("target", "ordin");
  u.searchParams.set("MST", String(mst));
  u.searchParams.set("type", type);

  const res = await fetch(u.toString(), {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-crawler/1.0",
      accept: type === "JSON" ? "application/json,text/plain,*/*" : "text/html,*/*",
    },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`ORDIN_TEXT_HTTP_${res.status}: ${text.slice(0, 200)}`);

  if (type === "JSON") {
    try {
      return { finalUrl: res.url, data: JSON.parse(text) };
    } catch {
      throw new Error(`ORDIN_TEXT_NOT_JSON: ${text.slice(0, 120)}`);
    }
  }

  return { finalUrl: res.url, html: text };
}

// ---------------------------------------------------------
// ✅ (실수집 1단계) 시도/시군구 입력으로 "주차" 조례 목록을 실제로 가져오기
//
// 방법:
// - org(시도)만 구해서 sborg 없이 목록 조회
// - 결과 rows 중 orgName에 sigungu 문자열이 포함된 것만 필터
// - limit만큼 모을 때까지 페이지를 넘겨가며 수집
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
      sborg: "", // ✅ 핵심: 시도 단위로 넓게 조회
      query,
      search: searchMode,
      display: 100,
      page,
      sort: "ddes",
    });

    const rows = r.rows || [];
    if (!rows.length) break;

    // 시군구 필터(기관명에 "성동구" 포함 등)
    for (const row of rows) {
      const orgName = row.orgName || "";
      if (orgName.includes(s2)) {
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

  // 중복 제거(같은 조례가 여러 페이지/검색으로 잡힐 수 있음)
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
    resolved: { org, sborg: null },
    collected: items.length,
    items,
    debug: debug
      ? {
          pagesTried: page - 1,
          maxPages,
          throttleMs,
        }
      : undefined,
  };
}

// ---------------------------------------------------------
// ✅ API에서 쉽게 부르도록 run() 제공
// - functions/api에서 동적 import로 이 함수를 잡아 호출할 수 있음
// ---------------------------------------------------------
export async function run({
  oc,
  sido,
  sigungu,
  limit = 30,
  debug = false,
  query = "주차",
}) {
  return crawlParkingOrdinanceIndex({
    oc,
    sido,
    sigungu,
    limit,
    debug,
    query,
  });
}