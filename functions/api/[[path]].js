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
  // 응답 구조가 종종 바뀌어서 최대한 넓게 커버
  // 보통: data.법령.조문.조문단위[] 형태 or 유사 구조
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
  // 키 후보들을 넓게 잡음
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
  // D1은 한번에 너무 큰 batch는 피하는게 안전
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

    // batch 실행
    await DB.batch(stmts);
    insertedOrIgnored += part.length;
  }

  return insertedOrIgnored;
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

    // ✅ NEW: GET /api/rules/tree?topic=coverage
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

    // ✅ 개선: GET /api/law/meta/search?q=건축&onDate=2026-02-27
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

    // ✅ 단건 조회(권장)
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

    // ✅ 기존 호환 유지
    if (request.method === "GET" && path === "law/article") {
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const articleNo = url.searchParams.get("articleNo") || "";
      if (!lawId || !articleNo) {
        return json({ ok: false, error: "MISSING_PARAMS", need: ["lawId", "articleNo"] }, 400);
      }
      const row = await getLawArticle(env.DB, lawId, articleNo);
      return json({ ok: true, row });
    }

    // ✅ NEW: 전조문 자동수집(Workers에서 실행)
    // POST /api/law/ingest
    // body 예시:
    // { "lawKey": "001823" }  // 건축법 law_key 기준 최신 시행 mst 선택 후 전조문 저장
    // 또는 { "mst": "276925" } // mst로 직접 지정(이 경우 law_version에서 law_key 역조회)
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

      // mst만 오면 law_key 역조회
      if (!lawKey && mst) {
        lawKey = await getLawKeyByMst(env.DB, mst);
      }

      if (!mst) {
        // lawKey 기준 최신 시행 mst 선택
        if (!lawKey) {
          return json({ ok: false, error: "MISSING_PARAMS", need: ["lawKey or mst"] }, 400);
        }
        mst = (await getEffectiveMst(env.DB, lawKey, onDate)) || "";
      }

      if (!lawKey || !mst) {
        return json({ ok: false, error: "CANNOT_RESOLVE", lawKey: lawKey || null, mst: mst || null }, 400);
      }

      // lawService 호출 → 조문 파싱
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

      // D1 저장
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