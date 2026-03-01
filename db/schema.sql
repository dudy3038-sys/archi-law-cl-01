-- db/schema.sql (FULL REPLACE)
-- =========================
-- v2 schema: versioned laws (SAFE VERSION) + parking ordinance storage
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_node_ref
ON rule_node_ref (node_key, law_key, IFNULL(mst,''), article_no);

-- =========================================================
-- ✅ 주차 조례(자치법규) 저장용 테이블 (NEW)
-- 목적:
-- 1) 지자체(sido/sigungu)별로 "주차" 관련 조례 목록 인덱스 저장
-- 2) ordinId별 조례 본문/별표 텍스트 저장 (다음 단계에서 파싱)
-- =========================================================

-- 지자체 키(캐시/인덱스용)
CREATE TABLE IF NOT EXISTS parking_jurisdiction (
  jur_key TEXT PRIMARY KEY,          -- e.g. "서울특별시__성동구"
  sido TEXT NOT NULL,
  sigungu TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_parking_jurisdiction_sido ON parking_jurisdiction(sido);
CREATE INDEX IF NOT EXISTS idx_parking_jurisdiction_sigungu ON parking_jurisdiction(sigungu);

-- 조례 인덱스(목록)
CREATE TABLE IF NOT EXISTS parking_ordinance_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jur_key TEXT NOT NULL,
  ordin_id TEXT NOT NULL,            -- 자치법규ID
  name TEXT NOT NULL,                -- 자치법규명
  org_name TEXT,                     -- 지자체기관명
  kind TEXT,                         -- 자치법규종류
  field TEXT,                        -- 자치법규분야명
  eff_date TEXT,                     -- 시행일자
  ann_date TEXT,                     -- 공포일자
  ann_no TEXT,                       -- 공포번호
  link TEXT,                         -- 자치법규상세링크
  collected_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(jur_key, ordin_id),
  FOREIGN KEY (jur_key) REFERENCES parking_jurisdiction(jur_key)
);

CREATE INDEX IF NOT EXISTS idx_parking_index_jur ON parking_ordinance_index(jur_key);
CREATE INDEX IF NOT EXISTS idx_parking_index_ordin ON parking_ordinance_index(ordin_id);
CREATE INDEX IF NOT EXISTS idx_parking_index_name ON parking_ordinance_index(name);

-- 조례 본문/별표 원문 저장 (원문은 길 수 있으니 TEXT)
CREATE TABLE IF NOT EXISTS parking_ordinance_text (
  ordin_id TEXT PRIMARY KEY,
  jur_key TEXT,
  name TEXT,
  source_url TEXT,
  raw_json TEXT,                     -- DRF 응답 원문(JSON string)
  body_text TEXT,                    -- 조례 본문(정리된 텍스트)
  tables_text TEXT,                  -- 별표/표(가능하면 추출해서 텍스트)
  collected_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (jur_key) REFERENCES parking_jurisdiction(jur_key)
);

CREATE INDEX IF NOT EXISTS idx_parking_text_jur ON parking_ordinance_text(jur_key);

-- (선택) 주차 설치기준 파싱 결과를 저장할 자리(다음 단계에서 사용)
CREATE TABLE IF NOT EXISTS parking_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jur_key TEXT NOT NULL,
  ordin_id TEXT,
  use_label TEXT NOT NULL,           -- 예: "업무시설"
  unit TEXT NOT NULL,                -- 예: "m2_per_space" / "per_household" 등
  value_num REAL NOT NULL,           -- 예: 150 (150㎡당 1대)
  note TEXT,
  source TEXT,                       -- 조문/별표 위치 메모
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (jur_key) REFERENCES parking_jurisdiction(jur_key)
);

CREATE INDEX IF NOT EXISTS idx_parking_rules_jur ON parking_rules(jur_key);
CREATE INDEX IF NOT EXISTS idx_parking_rules_use ON parking_rules(use_label);