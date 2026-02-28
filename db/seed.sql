-- db/seed.sql (FULL REPLACE)
-- 목적(정공법 / A안):
-- 1) seed는 "법 데이터"를 절대 만들지 않는다. (law/law_version/law_article 삽입 금지)
-- 2) seed는 "법규 트리 뼈대(rule_topic/rule_node)"만 만든다.
-- 3) rule_node_ref(근거조문 매핑)는 "나중에 실제 법 DB가 채워진 뒤"에만 넣는다.
--    -> 그래야 항목-법 매칭이 틀어져도 구조가 꼬이지 않는다.

PRAGMA foreign_keys = ON;


-- =========================
-- 1) 법규 트리: 좌측 항목(topic)
-- =========================
INSERT OR IGNORE INTO rule_topic (topic_key, label, sort)
VALUES
  ('coverage', '건폐율', 1),
  ('far',      '용적률', 2),
  ('parking',  '주차대수 산정 기준', 3);

-- =========================
-- 2) 법규 트리: 노드(node)
-- - 지금 단계에서는 topic당 root 1개만
-- - 추후 세부 노드(하위 트리)는 parent_key로 확장
-- =========================
INSERT OR IGNORE INTO rule_node (node_key, topic_key, label, parent_key, sort)
VALUES
  ('coverage.root', 'coverage', '건폐율', NULL, 1),
  ('far.root',      'far',      '용적률', NULL, 1),
  ('parking.root',  'parking',  '주차대수 산정 기준', NULL, 1);

-- =========================
-- 3) 근거조문(rule_node_ref)
-- - ✅ seed에서 넣지 않는다(정공법)
-- - 이유: 아직 어떤 "법"이 맞는지(국토계획법/주차장법/건축법 등) 확정 전이고,
--   가짜/임시 매핑이 들어가면 UI에서 잘못된 조문이 표시되어 혼란/꼬임 발생.
-- - 매핑은 "법 DB 등록 + 조문 수집 완료" 후에 별도 SQL/스크립트로 넣는다.
-- =========================
