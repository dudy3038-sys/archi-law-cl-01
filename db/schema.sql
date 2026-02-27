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

-- =========================
-- A안: 법규트리 노드 + 근거조문(법/시행령/시행규칙) 매핑
-- (조례/지구단위계획은 지금 단계에서 제외)
-- =========================

-- 좌측 항목(예: 건폐율/용적률/주차대수 산정 기준 ...)
CREATE TABLE IF NOT EXISTS rule_topic (
  topic_key TEXT PRIMARY KEY,  -- 예: "coverage", "far", "parking"
  label TEXT NOT NULL,         -- 화면 표기명
  sort INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rule_topic_sort ON rule_topic(sort);

-- 항목 내부 트리 노드(최소 1뎁스만 써도 됨. 나중에 하위노드 확장 가능)
CREATE TABLE IF NOT EXISTS rule_node (
  node_key TEXT PRIMARY KEY,   -- 예: "coverage.root", "coverage.def", ...
  topic_key TEXT NOT NULL,     -- rule_topic.topic_key
  label TEXT NOT NULL,         -- 노드 표시명
  parent_key TEXT,             -- 상위 노드(node_key). 최상위는 NULL
  sort INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (topic_key) REFERENCES rule_topic(topic_key),
  FOREIGN KEY (parent_key) REFERENCES rule_node(node_key)
);

CREATE INDEX IF NOT EXISTS idx_rule_node_topic ON rule_node(topic_key);
CREATE INDEX IF NOT EXISTS idx_rule_node_parent ON rule_node(parent_key);
CREATE INDEX IF NOT EXISTS idx_rule_node_sort ON rule_node(sort);

-- 노드 ↔ 근거 조문 연결(법/시행령/시행규칙만)
CREATE TABLE IF NOT EXISTS rule_node_ref (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_key TEXT NOT NULL,      -- rule_node.node_key
  law_key TEXT NOT NULL,       -- law.law_key (예: 건축법/건축법시행령/건축법시행규칙 각각의 law_key)
  mst TEXT,                    -- 특정 버전 고정이 필요하면 지정. NULL이면 "최신 시행중"을 코드에서 선택.
  article_no TEXT NOT NULL,    -- 예: "제34조"
  ref_order INTEGER DEFAULT 0, -- 표시 순서
  note TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (node_key) REFERENCES rule_node(node_key),
  FOREIGN KEY (law_key) REFERENCES law(law_key),
  FOREIGN KEY (mst) REFERENCES law_version(mst),
  UNIQUE(node_key, law_key, IFNULL(mst,''), article_no)
);

CREATE INDEX IF NOT EXISTS idx_rule_ref_node ON rule_node_ref(node_key);
CREATE INDEX IF NOT EXISTS idx_rule_ref_law ON rule_node_ref(law_key);
CREATE INDEX IF NOT EXISTS idx_rule_ref_mst ON rule_node_ref(mst);