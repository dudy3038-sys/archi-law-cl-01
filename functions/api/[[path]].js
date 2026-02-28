// functions/api/[[path]].js (FULL REPLACE)
import { json } from "../../src/lib/response.js";
import { searchLawMeta } from "../../src/server/lawMeta.js";
import {
  searchLawArticle,
  getLawArticle,
  getRuleTopicTree,
  getEffectiveMst,
} from "../../src/server/lawArticle.js";
import { buildChecklist } from "../../src/server/checklist.js";

/**
 * law.go.kr DRF: 법령 본문(조문 포함) 조회
 * - 예: http://www.law.go.kr/DRF/lawService.do?OC=xxx&target=eflaw&MST=276925&type=JSON
 */
const LAW_SERVICE_URL = "http://www.law.go.kr/DRF/lawService.do";

function pickArticlesFromLawServiceJson(data) {
  const root = data?.법령 || data?.Law || data?.law || data;
  const jo = root?.조문 || root?.Jo || root?.articles || root?.article || root?.조문목록;
  const units =
    jo?.조문단위 ||
    jo?.joList ||
    jo?.list ||
    jo?.items ||
    root?.조문단위 ||
    root?.articles ||
    [];
  return Array.isArray(units) ? units : [];
}

function normalizeArticleUnit(u) {
  const articleNo =
    (u?.조문번호 || u?.조문번호명 || u?.조문명 || u?.articleNo || u?.article_no || "").toString().trim();
  const title =
    (u?.조문제목 || u?.제목 || u?.title || u?.조문제목명 || "").toString().trim();
  const body =
    (u?.조문내용 || u?.내용 || u?.body || u?.text || u?.조문 || "").toString().trim();

  if (!articleNo || !body) return null;

  return {
    article_no: articleNo,
    title: title || null,
    body,
  };
}

async function fetchLawServiceJson({ oc, mst }) {
  const u = new URL(LAW_SERVICE_URL);
  u.searchParams.set("OC", oc);
  u.searchParams.set("target", "eflaw");
  u.searchParams.set("type", "JSON");
  u.searchParams.set("MST", String(mst));

  const res = await fetch(u.toString(), {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-ingest/1.0",
      accept: "application/json,text/plain,*/*",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LAW_SERVICE_HTTP_${res.status}: ${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`LAW_SERVICE_NOT_JSON: ${text.slice(0, 120)}`);
  }
  return { data, finalUrl: res.url };
}

async function getLawKeyByMst(DB, mst) {
  const row = await DB.prepare(
    `SELECT law_key FROM law_version WHERE mst = ? LIMIT 1`
  ).bind(String(mst)).first();
  return row?.law_key ? String(row.law_key) : "";
}

async function upsertLawArticles(DB, { lawKey, mst, sourceUrl, articles }) {
  const CHUNK = 50;
  let insertedOrIgnored = 0;

  for (let i = 0; i < articles.length; i += CHUNK) {
    const part = articles.slice(i, i + CHUNK);

    const stmts = part.map((a) =>
      DB.prepare(
        `
        INSERT OR REPLACE INTO law_article
          (law_key, mst, article_no, title, body, source_url, updated_at)
        VALUES
          (?, ?, ?, ?, ?, ?, datetime('now'))
      `
      ).bind(lawKey, mst, a.article_no, a.title, a.body, sourceUrl || null)
    );

    await DB.batch(stmts);
    insertedOrIgnored += part.length;
  }

  return insertedOrIgnored;
}

// =========================================================
// ✅ 주차(법정) 계산 입력 연결용(1단계)
// - 아직 조례/기준 DB가 없으므로 "테스트 더미 산정"을 반환해서
//   프론트의 parkLegal이 실제로 변하는지 검증한다.
// =========================================================
function normalizeParkingPayload(body) {
  const jurisdiction = body?.jurisdiction || {};
  const sido = String(jurisdiction?.sido || "").trim();
  const sigungu = String(jurisdiction?.sigungu || "").trim();

  const usageAreasIn = Array.isArray(body?.usageAreas) ? body.usageAreas : [];
  const usageAreas = usageAreasIn
    .map((x) => {
      const use = String(x?.use || "").trim();
      const area = Number(x?.area_m2);
      const area_m2 = Number.isFinite(area) ? Math.round(area * 100) / 100 : 0;
      return { use, area_m2 };
    })
    .filter((x) => x.use && x.area_m2 > 0);

  const primaryUse = String(body?.primaryUse || "").trim();

  return { jurisdiction: { sido, sigungu }, usageAreas, primaryUse };
}

// =========================================================
// ✅ 크롤러 실행 유틸 (동적 import + 함수명 자동 탐색)
// =========================================================
async function runParkingCrawlerIndex({ limit, debug }) {
  const mod = await import("../../src/crawler/parkingCrawler.js");

  // 흔히 쓸 법한 export 이름 후보들
  const candidates = [
    "crawlParkingOrdinanceIndex",
    "crawlParkingIndex",
    "crawlIndex",
    "runParkingCrawler",
    "run",
    "main",
    "default",
  ];

  let fn = null;
  for (const name of candidates) {
    if (name === "default" && typeof mod?.default === "function") { fn = mod.default; break; }
    if (typeof mod?.[name] === "function") { fn = mod[name]; break; }
  }

  if (!fn) {
    const keys = Object.keys(mod || {});
    throw new Error(
      `PARKING_CRAWLER_EXPORT_NOT_FOUND: expected one of [${candidates.join(", ")}], got exports=[${keys.join(", ")}]`
    );
  }

  // limit/debug를 받는 크롤러일 수도, 아닐 수도 있어서 "최대한 안전 호출"
  // - 인자 0개로도 호출해보고
  // - 실패하면 옵션 인자로 한번 더 시도
  try {
    return await fn();
  } catch (e1) {
    try {
      return await fn({ limit, debug });
    } catch (e2) {
      // 두 에러 중 더 의미있는 걸 던짐
      throw new Error(`PARKING_CRAWLER_CALL_FAILED: ${String(e2?.message || e2)}`);
    }
  }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const seg = params.path || [];
  const path = Array.isArray(seg) ? seg.join("/") : seg;

  try {
    // GET /api/health
    if (request.method === "GET" && path === "health") {
      return json({ ok: true });
    }

    // =========================================================
    // ✅ NEW: 크롤러(주차 조례 인덱스) 실행
    // GET  /api/crawler/parking/index?limit=30&debug=1
    // POST /api/crawler/parking/index { "limit": 30, "debug": true }
    // =========================================================
    if (
      (request.method === "GET" || request.method === "POST") &&
      path === "crawler/parking/index"
    ) {
      let body = {};
      if (request.method === "POST") {
        body = await request.json().catch(() => ({}));
      }

      const limitQ = Number(url.searchParams.get("limit"));
      const debugQ = url.searchParams.get("debug");

      const limit = Number.isFinite(limitQ)
        ? Math.max(1, Math.min(500, limitQ))
        : Number.isFinite(Number(body?.limit))
        ? Math.max(1, Math.min(500, Number(body.limit)))
        : 100;

      const debug =
        (debugQ && debugQ !== "0") ||
        body?.debug === true ||
        body?.debug === "true";

      const startedAt = Date.now();
      const result = await runParkingCrawlerIndex({ limit, debug });
      const ms = Date.now() - startedAt;

      return json({
        ok: true,
        ran: "crawler/parking/index",
        limit,
        debug,
        took_ms: ms,
        result,
      });
    }

    // GET /api/rules/tree?topic=coverage
    if (request.method === "GET" && path === "rules/tree") {
      const topic = url.searchParams.get("topic") || "";
      const onDate = url.searchParams.get("onDate") || ""; // optional: YYYY-MM-DD
      if (!topic) {
        return json({ ok: false, error: "MISSING_PARAMS", need: ["topic"] }, 400);
      }
      const tree = await getRuleTopicTree(env.DB, topic, { onDate });
      if (!tree) {
        return json({ ok: false, error: "NOT_FOUND", topic }, 404);
      }
      return json({ ok: true, topic, tree });
    }

    // GET /api/law/meta/search?q=건축&onDate=2026-02-27
    if (request.method === "GET" && path === "law/meta/search") {
      const q = url.searchParams.get("q") || "";
      const onDate = url.searchParams.get("onDate") || "";
      const rows = await searchLawMeta(env.DB, q, { onDate });
      return json({ ok: true, q, onDate: onDate || null, rows });
    }

    // GET /api/law/article/search?q=피난&lawId=276925&limit=20
    if (request.method === "GET" && path === "law/article/search") {
      const q = url.searchParams.get("q") || "";
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const limitRaw = Number(url.searchParams.get("limit") || 20);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20;

      const rows = await searchLawArticle(env.DB, q, { mst: lawId, limit });
      return json({ ok: true, q, lawId, limit, rows });
    }

    // GET /api/law/article/get?lawId=276925&articleNo=제34조
    if (request.method === "GET" && path === "law/article/get") {
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const articleNo = url.searchParams.get("articleNo") || "";
      if (!lawId || !articleNo) {
        return json({ ok: false, error: "MISSING_PARAMS", need: ["lawId", "articleNo"] }, 400);
      }
      const row = await getLawArticle(env.DB, lawId, articleNo);
      return json({ ok: true, row });
    }

    // 기존 호환 유지
    if (request.method === "GET" && path === "law/article") {
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const articleNo = url.searchParams.get("articleNo") || "";
      if (!lawId || !articleNo) {
        return json({ ok: false, error: "MISSING_PARAMS", need: ["lawId", "articleNo"] }, 400);
      }
      const row = await getLawArticle(env.DB, lawId, articleNo);
      return json({ ok: true, row });
    }

    // POST /api/law/ingest
    if (request.method === "POST" && path === "law/ingest") {
      const body = await request.json().catch(() => ({}));

      const oc = (env.LAW_OC || "").toString().trim();
      if (!oc) {
        return json(
          { ok: false, error: "MISSING_ENV", need: ["LAW_OC"], hint: "Cloudflare Pages env var LAW_OC를 설정하세요." },
          500
        );
      }

      let lawKey = (body.lawKey || "").toString().trim();
      let mst = (body.mst || "").toString().trim();
      const onDate = (body.onDate || "").toString().trim() || ""; // optional

      if (!lawKey && mst) {
        lawKey = await getLawKeyByMst(env.DB, mst);
      }

      if (!mst) {
        if (!lawKey) {
          return json({ ok: false, error: "MISSING_PARAMS", need: ["lawKey or mst"] }, 400);
        }
        mst = (await getEffectiveMst(env.DB, lawKey, onDate)) || "";
      }

      if (!lawKey || !mst) {
        return json({ ok: false, error: "CANNOT_RESOLVE", lawKey: lawKey || null, mst: mst || null }, 400);
      }

      const { data, finalUrl } = await fetchLawServiceJson({ oc, mst });
      const rawUnits = pickArticlesFromLawServiceJson(data);
      const articles = rawUnits.map(normalizeArticleUnit).filter(Boolean);

      if (articles.length === 0) {
        return json({
          ok: false,
          error: "NO_ARTICLES_PARSED",
          lawKey,
          mst,
          hint: "law.go.kr 응답 구조가 예상과 다를 수 있습니다.",
        }, 500);
      }

      const saved = await upsertLawArticles(env.DB, {
        lawKey,
        mst,
        sourceUrl: finalUrl,
        articles,
      });

      return json({
        ok: true,
        lawKey,
        mst,
        saved,
        parsed: articles.length,
        source_url: finalUrl,
      });
    }

    // =========================================================
    // ✅ 주차(법정) - 건축개요 기반 입력 연결 엔드포인트
    // POST /api/parking/legal
    // - 현재는 WIRED_ONLY 이지만, 프론트가 갱신되도록 legalCount/formula 제공
    // =========================================================
    if (request.method === "POST" && path === "parking/legal") {
      const body = await request.json().catch(() => ({}));
      const payload = normalizeParkingPayload(body);

      const { sido, sigungu } = payload.jurisdiction;
      if (!sido || !sigungu) {
        return json(
          { ok: false, error: "MISSING_PARAMS", need: ["jurisdiction.sido", "jurisdiction.sigungu"] },
          400
        );
      }

      if (!payload.usageAreas.length) {
        return json(
          { ok: false, error: "MISSING_PARAMS", need: ["usageAreas (use, area_m2 > 0)"] },
          400
        );
      }

      const totalArea = Math.round(
        payload.usageAreas.reduce((acc, x) => acc + (Number(x.area_m2) || 0), 0) * 100
      ) / 100;

      // ✅ 테스트 더미 산정 (지자체 DB 붙이면 교체)
      const legalCount = Math.max(1, Math.ceil(totalArea / 1000));
      const formula = `TEST MODE(WIRED_ONLY): ceil(totalArea_m2 / 1000), 최소 1대 (총면적=${totalArea}㎡)`;

      return json({
        ok: true,
        mode: "WIRED_ONLY",
        jurisdiction: payload.jurisdiction,
        primaryUse: payload.primaryUse || null,
        usageAreas: payload.usageAreas,
        totalArea_m2: totalArea,

        // ✅ 프론트(index.html)가 기대하는 키
        legalCount,
        formula,

        // ✅ (기존/향후 호환용)
        legalParking: legalCount,
        message:
          "현재는 조례/부설주차장 설치기준 DB가 없어 테스트 산정값을 반환합니다. 다음 단계에서 지자체 기준 DB 연결 후 실제 산정으로 교체됩니다.",
        refs: [],

        debug: {
          receivedUsageAreasCount: payload.usageAreas.length,
        },
      });
    }

    // POST /api/checklist/build
    if (request.method === "POST" && path === "checklist/build") {
      const body = await request.json().catch(() => ({}));
      const out = await buildChecklist(env.DB, body);
      return json({ ok: true, ...out });
    }

    return json({ ok: false, error: "NOT_FOUND", path }, 404);
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}