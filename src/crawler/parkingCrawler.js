// src/crawler/parkingCrawler.js (FULL REPLACE)
//
// 목적(1차):
// - "국가법령정보센터 조례(자치법규)" 수집을 위한 크롤러 골격
// - 현재 단계에서는:
//   1) cityList.js는 "시도 목록 + 표준화 유틸"만 제공
//   2) org/sborg(기관코드) 및 시군구 목록은 "다음 단계"에서 자동 수집/캐시로 붙인다
//
// ⚠️ 중요:
// - 이전 버전은 CITY_LIST(전국 org/sborg 하드코딩)를 요구했지만,
//   지금은 그 방식을 버리고 "동적 수집"으로 가므로 CITY_LIST import를 제거한다.
// - 따라서 이 파일은 빌드를 깨지 않도록 하고,
//   실제 전국 수집은 다음 단계에서 '기관코드/시군구 목록 자동수집'을 구현하면 바로 확장된다.

import {
    SIDO_LIST,
    cleanText,
    normalizeSido,
    normalizeSigungu,
    jurisdictionKey,
    assertJurisdiction,
    getSigunguListBySido, // 현재는 [] 반환(인터페이스만)
  } from "./cityList.js";
  
  // DRF base (자치법규 검색)
  const DRF_BASE = "http://www.law.go.kr/DRF/lawSearch.do";
  
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  
  function toNum(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
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
  // (유지) 자치법규 목록 조회 (org/sborg가 있어야 동작)
  // ---------------------------------------------------------
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
    ordinFd = "",
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
    const list = pickListAny(data?.자치법규) || pickListAny(data);
    const rows = list.map(normalizeOrdinItem).filter(Boolean);
    return { url, rows, raw: data };
  }
  
  // ---------------------------------------------------------
  // ✅ 현재 단계의 결론:
  // - 전국 수집은 "org/sborg + 시군구 목록 자동수집"이 필요함
  // - 그런데 우리는 시도 목록만 두고, 시군구/기관코드는 다음 단계에서 크롤링으로 얻기로 했음
  //
  // 따라서 지금은 빌드가 깨지지 않도록 "스텁(미구현)"로 남기되,
  // 다음 단계에서 resolver(기관코드/시군구 수집)를 붙이면 즉시 전국 수집으로 확장 가능.
  // ---------------------------------------------------------
  export async function crawlParkingOrdinanceIndex({
    oc,
    throttleMs = 250,
    maxRegions = 0,
    searchMode = 1,
    query = "주차",
    // ✅ 다음 단계에서 주입할 resolver
    // resolveOrgSborg({ sido, sigungu }) -> { org, sborg }
    resolveOrgSborg = null,
    // ✅ 다음 단계에서 cityList.getSigunguListBySido()를 실제 구현하면 자동으로 돌아감
    getSigunguList = getSigunguListBySido,
  }) {
    if (!oc) throw new Error("MISSING_OC");
  
    // 아직 resolver가 없으면, 지금 단계에서는 명확히 에러로 알려주는 게 안전
    if (typeof resolveOrgSborg !== "function") {
      return {
        ok: false,
        error: "ORG_CODE_RESOLVER_NOT_IMPLEMENTED",
        message:
          "현재 cityList.js는 시도 목록만 제공하며, org/sborg(기관코드) 및 시군구 목록은 다음 단계에서 자동 수집/캐시로 구현합니다. " +
          "crawlParkingOrdinanceIndex를 전국 자동 수집으로 돌리려면 resolveOrgSborg() 구현이 먼저 필요합니다.",
        hintNextStep:
          "다음 단계: (1) 시도->시군구 목록 수집 구현 (2) 시군구->org/sborg 기관코드 매핑 수집 구현 후 resolveOrgSborg 주입",
        sidoCount: SIDO_LIST.length,
      };
    }
  
    const items = [];
    let regions = 0;
  
    for (const rawSido of SIDO_LIST) {
      const sido = normalizeSido(rawSido);
      const sigunguList = await getSigunguList(sido);
  
      for (const rawSigungu of sigunguList) {
        if (maxRegions && regions >= maxRegions) break;
  
        const sigungu = normalizeSigungu(rawSigungu);
        regions += 1;
  
        let org = "";
        let sborg = "";
        try {
          const r = await resolveOrgSborg({ sido, sigungu });
          org = String(r?.org || "").trim();
          sborg = String(r?.sborg || "").trim();
        } catch {
          org = "";
          sborg = "";
        }
  
        if (!org || !sborg) {
          await sleep(throttleMs);
          continue;
        }
  
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
  
        for (const row of r.rows || []) {
          items.push({
            sido,
            sigungu,
            org,
            sborg,
            ...row,
          });
        }
  
        await sleep(throttleMs);
      }
  
      if (maxRegions && regions >= maxRegions) break;
    }
  
    // 중복 제거
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