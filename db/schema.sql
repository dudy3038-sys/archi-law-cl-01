-- 법령 메타(목록)
CREATE TABLE IF NOT EXISTS law_meta (
  law_id TEXT PRIMARY KEY,
  law_name TEXT NOT NULL,
  ministry TEXT,
  시행일 TEXT,
  source_url TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_law_meta_name ON law_meta(law_name);

-- 조문 원문
CREATE TABLE IF NOT EXISTS law_article (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_id TEXT NOT NULL,
  article_no TEXT NOT NULL,     -- 예: "제34조"
  title TEXT,
  body TEXT NOT NULL,
  source_url TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(law_id, article_no)
);

CREATE INDEX IF NOT EXISTS idx_law_article_law ON law_article(law_id);
CREATE INDEX IF NOT EXISTS idx_law_article_text ON law_article(body);

-- 간이 룰(개요 -> 조문군 매핑 v1)
CREATE TABLE IF NOT EXISTS rule_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_key TEXT NOT NULL,       -- 예: "floors_ge_3"
  rule_desc TEXT,
  match_json TEXT NOT NULL,     -- 조건(JSON 문자열)
  targets_json TEXT NOT NULL,   -- 연결할 법령/조문(JSON 문자열)
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rule_key ON rule_map(rule_key);
