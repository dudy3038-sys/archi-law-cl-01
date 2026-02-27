// src/server/lawMeta.js (FULL REPLACE)

function todayISO() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * law 메타 검색
 * - q: 법령명(부분일치) 또는 law_key(부분일치)
 * - opts.onDate: "YYYY-MM-DD" (기준일). 기본: 오늘
 *
 * 반환: 각 law_key당 1개(기준일 기준 시행중 최신 버전 mst)
 */
export async function searchLawMeta(DB, q, opts = {}) {
  const query = String(q ?? "").trim();
  const like = `%${query}%`;
  const onDate = String(opts.onDate || "").trim() || todayISO();

  // q가 비어 있으면 전체를 보여주되, 너무 많이 나오지 않게 limit 유지
  const hasQ = query.length > 0;

  const sql = `
    SELECT
      l.law_key,
      l.law_name,
      l.ministry,
      v.mst,
      v.시행일,
      v.공포일,
      v.source_url
    FROM law l
    JOIN law_version v
      ON v.law_key = l.law_key
    WHERE
      (${hasQ ? "(l.law_name LIKE ? OR l.law_key LIKE ?)" : "1=1"})
      AND v.mst = (
        SELECT v2.mst
        FROM law_version v2
        WHERE v2.law_key = l.law_key
          -- ✅ 기준일(onDate) 기준으로 "시행중"만 고르기
          AND (v2.시행일 IS NULL OR v2.시행일 = '' OR v2.시행일 <= ?)
        ORDER BY
          -- 시행일 NULL/'' 은 뒤로 보내고, 날짜 큰 순서가 우선
          CASE WHEN (v2.시행일 IS NULL OR v2.시행일 = '') THEN 0 ELSE 1 END DESC,
          v2.시행일 DESC,
          v2.mst DESC
        LIMIT 1
      )
    ORDER BY l.law_name
    LIMIT 50
  `;

  const stmt = DB.prepare(sql);

  let out;
  if (hasQ) {
    out = await stmt.bind(like, like, onDate).all();
  } else {
    out = await stmt.bind(onDate).all();
  }

  return out?.results || [];
}