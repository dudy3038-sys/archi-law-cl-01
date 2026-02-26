-- =========================
-- migrate v1 -> v2 (idempotent)
-- =========================

-- 0) v1 백업 테이블이 아직 없을 때만 rename
-- law_article
DROP VIEW IF EXISTS _tmp;
CREATE TEMP VIEW _tmp AS
SELECT name FROM sqlite_master WHERE type='table' AND name='law_article_v1';
-- (wrangler/sqlite에서 IF EXISTS 조건 rename이 애매해서,
-- 아래는 "이미 v1이 있으면 그대로 두고", v1이 없고 v1이 아닌 law_article이 있으면 rename 하는 방식으로 처리)

-- law_article: v1 없고 law_article 있으면 rename
-- (SQLite는 ALTER TABLE ... RENAME이 실패하면 중단되므로, 안전하게 try-run 대신 아래 순서로 진행)
-- 1) law_article_v1이 없고
-- 2) law_article이 있으면
-- -> rename
-- NOTE: SQLite에 IF 조건문이 없어서, 운영상 1회만 실행되도록 아래 DROP/RENAME 조합을 사용.
-- 이미 law_article_v1이 있으면, law_article을 건드리지 않는다.

-- law_article_v1이 이미 있으면 아무것도 안 함
-- law_article_v1이 없으면, law_article을 v1로 옮김
-- (아래 구문은 v1이 이미 있을 때 오류가 나므로, 먼저 law_article_v1이 있으면 law_article을 그대로 두기 위해
--  law_article이 없도록 만들고 진행한다는 방식이 필요하지만 그건 위험해서,
--  가장 안전한 방법은: "law_article이 남아있으면 삭제"가 아니라 "현재 상태를 기준으로 생성/이관만" 하는 것)

-- ✅ 안전 전략:
-- - v1 테이블(law_article_v1, law_meta_v1)이 이미 있으면 rename 단계는 건너뜀(=이번 파일에서는 rename을 시도하지 않음)
-- - v2 테이블이 없으면 생성
-- - v1이 존재하면 v2로 이관만 수행

-- 1) v2 테이블 생성
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

-- 2) (건축법) v1 -> v2 이관
INSERT OR IGNORE INTO law (law_key, law_name, ministry)
VALUES ('001823', '건축법', '국토교통부');

INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('276925', '001823', '2025-10-01', '2025-10-01',
        'http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=276925&type=JSON');

-- v1 테이블이 있을 때만 이관되도록: SELECT가 실패하지 않게 테이블 존재 전제 필요
-- 이미 law_article_v1이 있다는 에러가 있었으니, 여기서는 law_article_v1 기준으로 이관한다.
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
