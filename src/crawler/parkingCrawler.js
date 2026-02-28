// src/crawler/parkingCrawler.js (FULL REPLACE)
//
// 목적:
// - 국가법령정보센터(DRF) "자치법규" API로 전국 지자체의 "주차" 관련 조례(30001) 목록을 수집
// - 1차 목표: "주차 관련 조례 목록 인덱스"를 만들기 (DB 적재는 다음 단계에서 연결)
//
// 사용 API (DRF):
// - 자치법규 목록:  http://www.law.go.kr/DRF/lawSearch.do?target=ordin
// - 자치법규 분야:  http://www.law.go.kr/DRF/lawSearch.do?target=ordinfd&org=...
//
// 참고: open.law.go.kr 가이드(ordinListGuide)에서 정의된 파라미터 기반
// - org: 도/광역/특별시 기관코드
// - sborg: 시/군/구 기관코드 (org가 필수)
// - knd: 30001(조례)
// - query/search: 검색어/검색범위

import { CITY_LIST } from "./cityList.js";

const DRF_BASE = "http://www.law.go.kr/DRF/lawSearch.do";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function pickListAny(root) {
  // 응답 구조가 바뀔 수 있어 넓게 커버
  // 일반적으로:
  // { "자치법규": [ ... ] } 또는 { "자치법규": { "자치법규": [ ... ] } } 같은 형태도 존재
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

  // 중첩 케이스
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
  // 가이드상 필드명:
  // 일련번호, 자치법규명, 자치법규ID, 공포일자, 공포번호, 제개정구분명, 지자체기관명,
  // 자치법규종류, 시행일자, 자치법규상세링크, 자치법규분야명
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

/**
 * 자치법규 "분야/분류" 목록 조회 (기관별)
 * - target=ordinfd&org=기관코드
 */
export async function fetchOrdinFdList({ oc, org }) {
  const url = buildUrl({
    OC: oc,
    target: "ordinfd",
    type: "JSON",
    org,
  });
  const data = await fetchJson(url);

  // 가능한 후보 키들
  const list =
    pickListAny(data?.분야) ||
    pickListAny(data?.ordinfd) ||
    pickListAny(data?.기관별분류) ||
    pickListAny(data);

  // 정규화: { seq, name, count }
  const out = [];
  for (const x of list) {
    const seq = String(x?.분류seq ?? x?.seq ?? x?.id ?? "").trim();
    const name = String(x?.분류명 ?? x?.name ?? "").trim();
    const count = toNum(x?.해당자치법규갯수 ?? x?.count ?? 0, 0);
    if (!seq || !name) continue;
    out.push({ seq, name, count });
  }
  return out;
}

/**
 * 자치법규 목록 조회
 * - target=ordin
 * - org/sborg(지자체) + query/search(키워드) + knd(조례)
 */
export async function fetchOrdinList({
  oc,
  org,
  sborg,
  query = "주차",
  search = 1, // 1: 자치법규명, 2: 본문검색
  knd = "30001", // 조례
  display = 100,
  page = 1,
  sort = "ddes", // 공포일자 내림차순
  ordinFd = "", // 분류코드(있으면 더 정확)
}) {
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

  // 목록 후보: data.자치법규.자치법규[] 같은 구조가 많음
  const list = pickListAny(data?.자치법규) || pickListAny(data);

  const rows = list
    .map(normalizeOrdinItem)
    .filter(Boolean);

  return { url, rows, raw: data };
}

/**
 * "주차"에 가까운 분야/분류 코드를 기관(org)에서 찾기
 * - 분류명이 '주차'를 포함하면 1순위
 * - 없으면 '교통'/'자동차' 등 후보를 약하게 선택(옵션)
 */
function pickParkingFdCandidates(fdList) {
  const strong = fdList.filter((x) => x.name.includes("주차"));
  if (strong.length) return strong;

  const weak = fdList.filter(
    (x) =>
      x.name.includes("교통") ||
      x.name.includes("자동차") ||
      x.name.includes("도로") ||
      x.name.includes("건축") // 일부 지자체는 건축/도시 쪽에 묶임
  );
  return weak;
}

/**
 * 전국 수집(인덱스)
 * - CITY_LIST(시도/시군구 코드) 기반으로 sborg까지 내려가며 검색
 *
 * 반환:
 * {
 *   ok: true,
 *   collected: number,
 *   regions: number,
 *   items: [
 *     { sido, sigungu, org, sborg, ordinId, name, link, ... }
 *   ]
 * }
 */
export async function crawlParkingOrdinanceIndex({
  oc,
  throttleMs = 250,
  maxRegions = 0, // 0이면 전체
  searchMode = 1, // 기본: 자치법규명 검색
  query = "주차",
}) {
  if (!oc) throw new Error("MISSING_OC");

  const items = [];
  let regions = 0;

  // CITY_LIST는 네가 방금 교체한 파일 기준으로:
  // [
  //  { sido:"경기도", org:"6410000", sigungu:[{ name:"수원시 팔달구", sborg:"..."}, ...] },
  //  ...
  // ]
  for (const s of CITY_LIST) {
    const sido = String(s?.sido || "").trim();
    const org = String(s?.org || "").trim();
    const sigunguList = Array.isArray(s?.sigungu) ? s.sigungu : [];

    if (!sido || !org || !sigunguList.length) continue;

    // 1) org 단위로 ordinfd 조회 -> 주차 관련 분류코드 후보 찾기
    let fdCandidates = [];
    try {
      const fdList = await fetchOrdinFdList({ oc, org });
      fdCandidates = pickParkingFdCandidates(fdList);
    } catch {
      // ordinfd 실패해도 query 검색으로 fallback 가능
      fdCandidates = [];
    }

    for (const g of sigunguList) {
      if (maxRegions && regions >= maxRegions) break;

      const sigungu = String(g?.name || "").trim();
      const sborg = String(g?.sborg || "").trim();
      if (!sigungu || !sborg) continue;

      regions += 1;

      // 2) 분류코드 후보가 있으면 먼저 ordinFd 검색 시도(정확도↑)
      let rows = [];
      let used = { mode: "query", ordinFd: "" };

      if (fdCandidates.length) {
        // 후보를 순서대로 시도: 결과가 있으면 그걸 사용
        for (const fd of fdCandidates) {
          try {
            const r = await fetchOrdinList({
              oc,
              org,
              sborg,
              query: "*", // 분류코드 검색 시 query는 와일드카드로 넓게
              search: searchMode,
              ordinFd: fd.seq,
              display: 100,
              page: 1,
            });
            const got = r.rows || [];
            if (got.length) {
              rows = got;
              used = { mode: "ordinFd", ordinFd: fd.seq, ordinFdName: fd.name };
              break;
            }
          } catch {
            // 다음 후보
          }
          await sleep(throttleMs);
        }
      }

      // 3) 분류코드로 못 찾았으면 query 검색으로 fallback
      if (!rows.length) {
        try {
          const r = await fetchOrdinList({
            oc,
            org,
            sborg,
            query,
            search: searchMode,
            ordinFd: "",
            display: 100,
            page: 1,
          });
          rows = r.rows || [];
          used = { mode: "query", query };
        } catch {
          rows = [];
        }
      }

      // 4) 결과 누적(지자체 메타 붙이기)
      for (const row of rows) {
        // “주차장 설치” 류만 남기고 싶으면 여기서 더 필터 가능
        // 지금은 인덱스 구축 단계라 넓게 담아두는 게 유리
        items.push({
          sido,
          sigungu,
          org,
          sborg,
          picked: used,
          ...row,
        });
      }

      await sleep(throttleMs);
    }

    if (maxRegions && regions >= maxRegions) break;
  }

  // ordinId 중복 제거(같은 조례가 여러 검색으로 잡히는 경우)
  const uniq = new Map();
  for (const it of items) {
    const key = `${it.sborg}::${it.ordinId}`;
    if (!uniq.has(key)) uniq.set(key, it);
  }

  return {
    ok: true,
    regions,
    collected: uniq.size,
    items: Array.from(uniq.values()),
  };
}