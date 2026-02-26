// v2 schema adapter
// - DB: law_article(law_key, mst, article_no, ...)
// - Backward compatibility: API/프론트에서 lawId를 보내면 "mst"로 해석
// - Response keeps "law_id" field (mapped from mst) so existing UI keeps working

export async function searchLawArticle(DB, q, opts = {}) {
  const like = `%${q}%`;

  // opts:
  // - mst: 특정 버전(예: 276925)만 검색
  // - lawKey: 특정 법령(예: 001823)만 검색 (선택)
  // - limit: 기본 50, 최대 100
  const mst = String(opts.mst || opts.lawId || "").trim();
  const lawKey = String(opts.lawKey || "").trim();
  const limitRaw = Number(opts.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;

  // 조건 조립
  const where = [];
  const binds = [];

  // 텍스트 검색
  where.push("(body LIKE ? OR title LIKE ?)");
  binds.push(like, like);

  if (mst) {
    where.push("mst = ?");
    binds.push(mst);
  }
  if (lawKey) {
    where.push("law_key = ?");
    binds.push(lawKey);
  }

  const sql = `
    SELECT
      mst AS law_id,               -- ✅ 기존 UI/응답 호환
      article_no,
      title,
      substr(body,1,200) AS preview
    FROM law_article
    WHERE ${where.join(" AND ")}
    ORDER BY mst, article_no
    LIMIT ?
  `;

  const { results } = await DB.prepare(sql).bind(...binds, limit).all();
  return results || [];
}

export async function getLawArticle(DB, lawIdOrMst, articleNo) {
  // lawIdOrMst: 기존 코드에서는 lawId였지만 v2에서는 mst로 해석
  const mst = String(lawIdOrMst || "").trim();
  const art = String(articleNo || "").trim();
  if (!mst || !art) return null;

  const row = await DB
    .prepare(`
      SELECT
        mst AS law_id,              -- ✅ 기존 UI/응답 호환
        article_no,
        title,
        body,
        source_url
      FROM law_article
      WHERE mst = ? AND article_no = ?
      LIMIT 1
    `)
    .bind(mst, art)
    .first();

  return row || null;
}