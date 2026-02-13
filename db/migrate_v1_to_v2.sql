-- =========================
-- migrate v1 -> v2 (safe)
-- =========================

-- 0) v1 테이블 백업(이름 변경)
ALTER TABLE law_article RENAME TO law_article_v1;
ALTER TABLE law_meta RENAME TO law_meta_v1;

-- 1) v2 테이블 생성 (schema.sql과 동일하게)
CREATE TABLE IF NOT EXISTS law (
  law_key TEXT PRIMARY KEY,
  law_name TEXT NOT NULL,
  ministry TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_law_name ON law(law_name);

CREATE TABLE IF NOT EXISTS law_version (
  mst TEXT PRIMARY KEY,
  law_key TEXT NOT NULL,
  시행일 TEXT,
  공포일 TEXT,
  source_url TEXT,
  collected_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_law_version_lawkey ON law_version(law_key);
CREATE INDEX IF NOT EXISTS idx_law_version_eff ON law_version(시행일);

CREATE TABLE IF NOT EXISTS law_article (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  law_key TEXT NOT NULL,
  mst TEXT NOT NULL,
  article_no TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  source_url TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(law_key, mst, article_no)
);
CREATE INDEX IF NOT EXISTS idx_law_article_mst ON law_article(mst);
CREATE INDEX IF NOT EXISTS idx_law_article_lawkey ON law_article(law_key);
CREATE INDEX IF NOT EXISTS idx_law_article_text ON law_article(body);

-- 2) (현재 확보한 건축법) v1 데이터 → v2로 이관
--    v1에서는 law_id가 MST(276925)였음.
--    law_key는 건축법의 고정 법령ID "001823"로 고정(너가 확보한 값)
INSERT OR IGNORE INTO law (law_key, law_name, ministry)
VALUES ('001823', '건축법', '국토교통부');

INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('276925', '001823', '2025-10-01', '2025-10-01', 'http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=276925&type=JSON');

INSERT OR IGNORE INTO law_article (law_key, mst, article_no, title, body, source_url, updated_at)
SELECT
  '001823' as law_key,
  law_id   as mst,
  article_no,
  title,
  body,
  source_url,
  updated_at
FROM law_article_v1
WHERE law_id = '276925';
