-- db/seed.sql (FULL REPLACE)
-- 목적:
-- 1) 중복 실행해도 안전(INSERT OR IGNORE 중심)
-- 2) Cloudflare D1 기존 데이터(특히 mst=276925 등)와 충돌 회피
-- 3) FK 순서 보장: law -> law_version -> law_article -> rule_topic -> rule_node -> rule_node_ref

PRAGMA foreign_keys = ON;

BEGIN;

-- =========================
-- 기본 샘플 법령 (건축법/시행령/시행규칙 테스트용)
-- =========================
-- ⚠️ 주의:
-- 이미 DB에 mst='276925'가 다른 law_key(예: '001823')로 존재할 수 있음.
-- 그래서 LAW_ARCH 쪽은 mst를 "276925_ARCH"처럼 별도 텍스트로 만들어 충돌을 피한다.

-- 1) 법 본체
INSERT OR IGNORE INTO law (law_key, law_name, ministry)
VALUES
  ('LAW_ARCH',       '건축법',        '국토교통부'),
  ('LAW_ARCH_ENF',   '건축법 시행령',  '국토교통부'),
  ('LAW_ARCH_RULE',  '건축법 시행규칙', '국토교통부');

-- 2) 버전 (샘플 mst)
-- LAW_ARCH는 충돌 방지를 위해 mst를 별도 키로 사용
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일)
VALUES
  ('276925_ARCH', 'LAW_ARCH',      '2025-01-01', '2024-12-01'),
  ('276926',      'LAW_ARCH_ENF',  '2025-01-01', '2024-12-01'),
  ('276927',      'LAW_ARCH_RULE', '2025-01-01', '2024-12-01');

-- 3) 샘플 조문
INSERT OR IGNORE INTO law_article (law_key, mst, article_no, title, body)
VALUES
  ('LAW_ARCH',      '276925_ARCH', '제55조', '건폐율',        '건폐율은 대통령령으로 정하는 기준에 따른다.'),
  ('LAW_ARCH_ENF',  '276926',      '제84조', '건폐율의 기준', '건폐율 기준은 용도지역에 따라 정한다.'),
  ('LAW_ARCH_RULE', '276927',      '제21조', '건폐율 산정방법', '건폐율 산정방법은 다음과 같다.');

-- =========================
-- 법규 트리 (A안 핵심)
-- =========================

-- 4) 좌측 항목
INSERT OR IGNORE INTO rule_topic (topic_key, label, sort)
VALUES
  ('coverage', '건폐율', 1),
  ('far',      '용적률', 2),
  ('parking',  '주차대수 산정 기준', 3);

-- 5) 노드 (topic당 root 1개)
-- FK(rule_node.topic_key -> rule_topic.topic_key) 때문에 rule_topic이 먼저 있어야 함
INSERT OR IGNORE INTO rule_node (node_key, topic_key, label, parent_key, sort)
VALUES
  ('coverage.root', 'coverage', '건폐율', NULL, 1),
  ('far.root',      'far',      '용적률', NULL, 1),
  ('parking.root',  'parking',  '주차대수 산정 기준', NULL, 1);

-- 6) 노드 ↔ 법/시행령/시행규칙 연결
-- ✅ 반드시 OR IGNORE 사용 (재실행/중복 방지)
-- ✅ LAW_ARCH는 mst='276925_ARCH'를 사용해야 FK가 성립함
INSERT OR IGNORE INTO rule_node_ref (node_key, law_key, mst, article_no, ref_order)
VALUES
  ('coverage.root', 'LAW_ARCH',      '276925_ARCH', '제55조', 1),
  ('coverage.root', 'LAW_ARCH_ENF',  '276926',      '제84조', 2),
  ('coverage.root', 'LAW_ARCH_RULE', '276927',      '제21조', 3);

COMMIT;