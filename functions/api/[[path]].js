import { json } from "../../src/lib/response.js";
import { searchLawMeta } from "../../src/server/lawMeta.js";
import { searchLawArticle, getLawArticle } from "../../src/server/lawArticle.js";
import { buildChecklist } from "../../src/server/checklist.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const seg = (params.path || []);
  const path = Array.isArray(seg) ? seg.join("/") : seg;

  try {
    // GET /api/law/meta/search?q=건축
    if (request.method === "GET" && path === "law/meta/search") {
      const q = url.searchParams.get("q") || "";
      const rows = await searchLawMeta(env.DB, q);
      return json({ ok: true, q, rows });
    }

    // GET /api/law/article/search?q=피난
    if (request.method === "GET" && path === "law/article/search") {
      const q = url.searchParams.get("q") || "";
      const rows = await searchLawArticle(env.DB, q);
      return json({ ok: true, q, rows });
    }

    // GET /api/law/article?lawId=...&articleNo=제34조
    if (request.method === "GET" && path === "law/article") {
      const lawId = url.searchParams.get("lawId") || "";
      const articleNo = url.searchParams.get("articleNo") || "";
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
