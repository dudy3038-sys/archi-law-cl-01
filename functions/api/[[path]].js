import { json } from "../../src/lib/response.js";
import { searchLawMeta } from "../../src/server/lawMeta.js";
import { searchLawArticle, getLawArticle } from "../../src/server/lawArticle.js";
import { buildChecklist } from "../../src/server/checklist.js";

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

    // GET /api/law/meta/search?q=건축
    if (request.method === "GET" && path === "law/meta/search") {
      const q = url.searchParams.get("q") || "";
      const rows = await searchLawMeta(env.DB, q);
      return json({ ok: true, q, rows });
    }

    // GET /api/law/article/search?q=피난&lawId=276925&limit=20
    // - lawId(선택): mst(버전)로 필터 (기존 파라미터명 유지)
    // - limit(선택): 기본 20, 최대 100
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
    // GET /api/law/article?lawId=...&articleNo=제34조
    if (request.method === "GET" && path === "law/article") {
      const lawId = url.searchParams.get("lawId") || ""; // mst
      const articleNo = url.searchParams.get("articleNo") || "";
      if (!lawId || !articleNo) {
        return json({ ok: false, error: "MISSING_PARAMS", need: ["lawId", "articleNo"] }, 400);
      }
      const row = await getLawArticle(env.DB, lawId, articleNo);
      return json({ ok: true, row });
    }

    // POST /api/checklist/build  (건축개요 -> 체크리스트)
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