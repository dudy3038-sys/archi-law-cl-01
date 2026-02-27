// src/server/lawArticle.js (FULL REPLACE)
// v2 schema adapter
// - DB: law_article(law_key, mst, article_no, ...)
// - Backward compatibility: API/프론트에서 lawId를 보내면 "mst"로 해석
// - Response keeps "law_id" field (mapped from mst) so existing UI keeps working
//
// + A안(수동 매핑) 지원:
//   - rule_topic / rule_node / rule_node_ref 를 읽어서
//   - 법/시행령/시행규칙 근거조문을 자동으로 채워주는 트리 데이터 반환

function todayISO() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function classifyLawType(lawName = "") {
  // 조례/지구단위계획은 지금 단계에서 다루지 않음
  if (lawName.includes("시행령")) return "enforcement_decree";
  if (lawName.includes("시행규칙")) return "enforcement_rule";
  return "law";
}

// ✅ law_key에 대해 "오늘 기준 시행중인 최신 mst" 선택
export async function getEffectiveMst(DB, lawKey, onDate = todayISO()) {
  const key = String(lawKey || "").trim();
  const dt = String(onDate || "").trim() || todayISO();
  if (!key) return null;

  // 시행일이 NULL인 경우도 있을 수 있어, 가능한 값들을 뒤에서 보조로 정렬
  const row = await DB.prepare(
    `
    SELECT mst
    FROM law_version
    WHERE law_key = ?
      AND (시행일 IS NULL OR 시행일 <= ?)
    ORDER BY
      CASE WHEN 시행일 IS NULL THEN 0 ELSE 1 END DESC,
      시행일 DESC,
      mst DESC
    LIMIT 1
  `
  )
    .bind(key, dt)
    .first();

  return row?.mst ? String(row.mst) : null;
}

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

  const row = await DB.prepare(
    `
      SELECT
        mst AS law_id,              -- ✅ 기존 UI/응답 호환
        article_no,
        title,
        body,
        source_url
      FROM law_article
      WHERE mst = ? AND article_no = ?
      LIMIT 1
    `
  )
    .bind(mst, art)
    .first();

  return row || null;
}

/**
 * ✅ A안: topic_key(예: "coverage")에 해당하는 법규 트리 + 근거조문 자동 채움
 *
 * 반환 예시(개략):
 * {
 *   topic: { topic_key, label },
 *   nodes: [
 *     {
 *       node_key, label, parent_key,
 *       refs: {
 *         law: [{ law_key, law_name, mst, article_no, title, body, source_url, note }],
 *         enforcement_decree: [...],
 *         enforcement_rule: [...]
 *       }
 *     }
 *   ]
 * }
 */
export async function getRuleTopicTree(DB, topicKey, opts = {}) {
  const tkey = String(topicKey || "").trim();
  if (!tkey) return null;

  const onDate = String(opts.onDate || "").trim() || todayISO();

  const topic = await DB.prepare(
    `SELECT topic_key, label, sort FROM rule_topic WHERE topic_key = ? LIMIT 1`
  )
    .bind(tkey)
    .first();

  if (!topic) return null;

  const { results: nodesRaw } = await DB.prepare(
    `
    SELECT node_key, topic_key, label, parent_key, sort
    FROM rule_node
    WHERE topic_key = ?
    ORDER BY sort, node_key
  `
  )
    .bind(tkey)
    .all();

  const nodes = (nodesRaw || []).map((n) => ({
    node_key: n.node_key,
    topic_key: n.topic_key,
    label: n.label,
    parent_key: n.parent_key ?? null,
    sort: n.sort ?? 0,
    refs: { law: [], enforcement_decree: [], enforcement_rule: [] },
  }));

  // node_key -> index
  const nodeIndex = new Map(nodes.map((n, i) => [n.node_key, i]));

  // refs 가져오기
  const { results: refsRaw } = await DB.prepare(
    `
    SELECT
      r.id,
      r.node_key,
      r.law_key,
      r.mst,
      r.article_no,
      r.ref_order,
      r.note,
      l.law_name
    FROM rule_node_ref r
    JOIN law l ON l.law_key = r.law_key
    WHERE r.node_key IN (
      SELECT node_key FROM rule_node WHERE topic_key = ?
    )
    ORDER BY r.node_key, r.ref_order, r.id
  `
  )
    .bind(tkey)
    .all();

  for (const ref of refsRaw || []) {
    const idx = nodeIndex.get(ref.node_key);
    if (idx == null) continue;

    const lawKey = String(ref.law_key || "").trim();
    const lawName = String(ref.law_name || "").trim();
    const articleNo = String(ref.article_no || "").trim();
    const note = ref.note ?? null;

    // mst가 비어있으면 "오늘 기준 시행중 최신 mst" 자동 선택
    let mst = String(ref.mst || "").trim();
    if (!mst) {
      mst = (await getEffectiveMst(DB, lawKey, onDate)) || "";
    }

    // 조문 본문 조회 (없어도 죽지 않게)
    let article = null;
    if (mst && articleNo) {
      article = await getLawArticle(DB, mst, articleNo);
    }

    const item = {
      law_key: lawKey,
      law_name: lawName,
      mst: mst || null,
      article_no: articleNo,
      title: article?.title ?? null,
      body: article?.body ?? null,
      source_url: article?.source_url ?? null,
      note,
    };

    const bucket = classifyLawType(lawName);
    nodes[idx].refs[bucket].push(item);
  }

  return {
    topic: {
      topic_key: topic.topic_key,
      label: topic.label,
      sort: topic.sort ?? 0,
    },
    nodes,
    meta: { onDate },
  };
}