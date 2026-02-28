-- db/schema.sql (FULL REPLACE)
-- =========================
-- v2 schema: versioned laws (SAFE VERSION)
-- =========================

PRAGMA foreign_keys = ON;

-- =========================
-- 법령 고정 메타
-- =========================
CREATE TABLE IF NOT EXISTS law (
  law_key TEXT PRIMARY KEY,
  law_name TEXT NOT NULL,
  ministry TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_law_name ON law(law_name);

-- =========================
-- 법령 버전 (MST)
-- =========================
CREATE TABLE IF NOT EXISTS law_version (
  mst TEXT PRIMARY KEY,
  law_key TEXT NOT NULL,
  시행일 TEXT,
  공포일 TEXT,
  source_url TEXT,
  collected_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (law_key) REFERENCES law(law_key)
);
CREATE INDEX IF NOT EXISTS idx_law_version_lawkey ON law_version(law_key);
CREATE INDEX IF NOT EXISTS idx_law_version_eff ON law_version(시행일);

-- =========================
-- 조문 원문 (버전 포함)
-- =========================
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

-- ❌ 매우 중요: body TEXT 인덱스 제거 (성능 치명적)
DROP INDEX IF EXISTS idx_law_article_text;


-- =========================
-- 간이 룰
-- =========================
CREATE TABLE IF NOT EXISTS rule_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_key TEXT NOT NULL,
  rule_desc TEXT,
  match_json TEXT NOT NULL,
  targets_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rule_key ON rule_map(rule_key);


-- =========================
-- 법규 트리 topic
-- =========================
CREATE TABLE IF NOT EXISTS rule_topic (
  topic_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rule_topic_sort ON rule_topic(sort);


-- =========================
-- 트리 노드
-- =========================
CREATE TABLE IF NOT EXISTS rule_node (
  node_key TEXT PRIMARY KEY,
  topic_key TEXT NOT NULL,
  label TEXT NOT NULL,
  parent_key TEXT,
  sort INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (topic_key) REFERENCES rule_topic(topic_key),
  FOREIGN KEY (parent_key) REFERENCES rule_node(node_key)
);
CREATE INDEX IF NOT EXISTS idx_rule_node_topic ON rule_node(topic_key);
CREATE INDEX IF NOT EXISTS idx_rule_node_parent ON rule_node(parent_key);
CREATE INDEX IF NOT EXISTS idx_rule_node_sort ON rule_node(sort);


-- =========================
-- 노드 ↔ 조문 매핑
-- =========================
CREATE TABLE IF NOT EXISTS rule_node_ref (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_key TEXT NOT NULL,
  law_key TEXT NOT NULL,
  mst TEXT,                    -- NULL 가능 (코드에서 최신 선택)
  article_no TEXT NOT NULL,
  ref_order INTEGER DEFAULT 0,
  note TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_key) REFERENCES rule_node(node_key),
  FOREIGN KEY (law_key) REFERENCES law(law_key),
  FOREIGN KEY (mst) REFERENCES law_version(mst)
);

CREATE INDEX IF NOT EXISTS idx_rule_ref_node ON rule_node_ref(node_key);
CREATE INDEX IF NOT EXISTS idx_rule_ref_law ON rule_node_ref(law_key);
CREATE INDEX IF NOT EXISTS idx_rule_ref_mst ON rule_node_ref(mst);

-- UNIQUE (표현식 허용)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_node_ref
ON rule_node_ref (node_key, law_key, IFNULL(mst,''), article_no);