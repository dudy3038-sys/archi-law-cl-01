export async function searchLawMeta(DB, q) {
  const like = `%${q}%`;
  const { results } = await DB
    .prepare("SELECT law_id, law_name, ministry, 시행일, source_url FROM law_meta WHERE law_name LIKE ? ORDER BY law_name LIMIT 50")
    .bind(like)
    .all();
  return results || [];
}
