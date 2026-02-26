export async function searchLawMeta(DB, q) {
  const like = `%${q}%`;

  const { results } = await DB.prepare(`
    SELECT 
      l.law_key,
      l.law_name,
      l.ministry,
      v.mst,
      v.시행일,
      v.공포일,
      v.source_url
    FROM law l
    JOIN law_version v ON l.law_key = v.law_key
    WHERE l.law_name LIKE ?
      AND v.mst = (
        SELECT mst
        FROM law_version v2
        WHERE v2.law_key = l.law_key
        ORDER BY v2.시행일 DESC
        LIMIT 1
      )
    ORDER BY l.law_name
    LIMIT 50
  `)
    .bind(like)
    .all();

  return results || [];
}