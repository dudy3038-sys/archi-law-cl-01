-- =========================
-- v2 schema: versioned laws
-- =========================

-- 법령 고정 메타 (법령 자체)
CREATE TABLE IF NOT EXISTS law (
  law_key TEXT PRIMARY KEY,     -- 예: 법령ID "001823" (고정)
  law_name TEXT NOT NULL,       -- 예: "건축법"
  ministry TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_law_name ON law(law_name);

-- 법령 버전(개정본) 메타 (MST 단위)
CREATE TABLE IF NOT EXISTS law_version (
  mst TEXT PRIMARY KEY,         -- 예: "276925" (버전)
  law_key TEXT NOT NULL,
  시행일 TEXT,                  -- YYYY-MM-DD
  공포일 TEXT,                  -- YYYY-MM-DD
  source_url TEXT,
  collected_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (law_key) REFERENCES law(law_key)
);

CREATE INDEX IF NOT EXISTS idx_law_version_lawkey ON law_version(law_key);
CREATE INDEX IF NOT EXISTS idx_law_version_eff ON law_version(시행일);

-- 조문 원문(버전 포함)
CREATE TABLE IF NOT EXISTS law_article (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_key TEXT NOT NULL,
  mst TEXT NOT NULL,
  article_no TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  source_url TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(law_key, mst, article_no),
  FOREIGN KEY (law_key) REFERENCES law(law_key),
  FOREIGN KEY (mst) REFERENCES law_version(mst)
);

CREATE INDEX IF NOT EXISTS idx_law_article_mst ON law_article(mst);
CREATE INDEX IF NOT EXISTS idx_law_article_lawkey ON law_article(law_key);
CREATE INDEX IF NOT EXISTS idx_law_article_text ON law_article(body);

-- 간이 룰(그대로 유지)
CREATE TABLE IF NOT EXISTS rule_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_key TEXT NOT NULL,
  rule_desc TEXT,
  match_json TEXT NOT NULL,
  targets_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rule_key ON rule_map(rule_key);
