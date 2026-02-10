function matchRule(matchJson, input) {
  // matchJson 예: {"floors":{"$gte":3}}
  // 아주 단순 버전(필요한 만큼 확장)
  try {
    const m = JSON.parse(matchJson);
    for (const key of Object.keys(m)) {
      const cond = m[key];
      const v = input[key];
      if (cond && typeof cond === "object" && "$gte" in cond) {
        if (!(Number(v) >= Number(cond.$gte))) return false;
      } else {
        if (v !== cond) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function buildChecklist(DB, input) {
  const floors = Number(input?.floors ?? 0);
  const area = Number(input?.area ?? 0);
  const use = String(input?.use ?? "");
  const summary = { floors, area, use };

  const { results: rules } = await DB.prepare("SELECT * FROM rule_map").all();
  const matched = (rules || []).filter(r => matchRule(r.match_json, summary));

  // 타겟 조문 수집
  const items = [];
  for (const r of matched) {
    let targets;
    try { targets = JSON.parse(r.targets_json); } catch { targets = null; }
    const laws = targets?.laws || [];
    for (const L of laws) {
      const lawId = L.law_id;
      const articles = L.articles || [];
      for (const aNo of articles) {
        const row = await DB
          .prepare("SELECT law_id, article_no, title, body, source_url FROM law_article WHERE law_id=? AND article_no=? LIMIT 1")
          .bind(lawId, aNo)
          .first();
        if (row) {
          items.push({
            rule_key: r.rule_key,
            rule_desc: r.rule_desc,
            law_id: row.law_id,
            article_no: row.article_no,
            title: row.title,
            body: row.body,
            source_url: row.source_url
          });
        }
      }
    }
  }

  return { input: summary, matched_rules: matched.map(r => ({ rule_key: r.rule_key, rule_desc: r.rule_desc })), checklist: items };
}
