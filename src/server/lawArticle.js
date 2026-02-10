export async function searchLawArticle(DB, q) {
  const like = `%${q}%`;
  const { results } = await DB
    .prepare("SELECT law_id, article_no, title, substr(body,1,200) AS preview FROM law_article WHERE body LIKE ? OR title LIKE ? ORDER BY law_id, article_no LIMIT 50")
    .bind(like, like)
    .all();
  return results || [];
}

export async function getLawArticle(DB, lawId, articleNo) {
  if (!lawId || !articleNo) return null;
  const row = await DB
    .prepare("SELECT law_id, article_no, title, body, source_url FROM law_article WHERE law_id=? AND article_no=? LIMIT 1")
    .bind(lawId, articleNo)
    .first();
  return row || null;
}
