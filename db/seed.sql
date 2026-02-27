-- =========================
-- 기본 샘플 법령 (건축법/시행령/시행규칙 테스트용)
-- =========================

-- 법 본체
INSERT OR IGNORE INTO law (law_key, law_name, ministry)
VALUES
('LAW_ARCH', '건축법', '국토교통부'),
('LAW_ARCH_ENF', '건축법 시행령', '국토교통부'),
('LAW_ARCH_RULE', '건축법 시행규칙', '국토교통부');

-- 버전 (샘플 mst)
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일)
VALUES
('276925', 'LAW_ARCH', '2025-01-01', '2024-12-01'),
('276926', 'LAW_ARCH_ENF', '2025-01-01', '2024-12-01'),
('276927', 'LAW_ARCH_RULE', '2025-01-01', '2024-12-01');

-- 샘플 조문
INSERT OR IGNORE INTO law_article (law_key, mst, article_no, title, body)
VALUES
('LAW_ARCH','276925','제55조','건폐율','건폐율은 대통령령으로 정하는 기준에 따른다.'),
('LAW_ARCH_ENF','276926','제84조','건폐율의 기준','건폐율 기준은 용도지역에 따라 정한다.'),
('LAW_ARCH_RULE','276927','제21조','건폐율 산정방법','건폐율 산정방법은 다음과 같다.');

-- =========================
-- 법규 트리 (A안 핵심)
-- =========================

-- 좌측 항목
INSERT OR IGNORE INTO rule_topic (topic_key, label, sort)
VALUES
('coverage', '건폐율', 1),
('far', '용적률', 2),
('parking', '주차대수 산정 기준', 3);

-- 노드 (지금은 topic당 root 1개만)
INSERT OR IGNORE INTO rule_node (node_key, topic_key, label, parent_key, sort)
VALUES
('coverage.root', 'coverage', '건폐율', NULL, 1),
('far.root', 'far', '용적률', NULL, 1),
('parking.root', 'parking', '주차대수 산정 기준', NULL, 1);

-- =========================
-- 🔥 핵심: 노드 ↔ 법/시행령/시행규칙 연결
-- =========================

-- 건폐율 → 법
INSERT INTO rule_node_ref (node_key, law_key, mst, article_no, ref_order)
VALUES
('coverage.root','LAW_ARCH','276925','제55조',1);

-- 건폐율 → 시행령
INSERT INTO rule_node_ref (node_key, law_key, mst, article_no, ref_order)
VALUES
('coverage.root','LAW_ARCH_ENF','276926','제84조',2);

-- 건폐율 → 시행규칙
INSERT INTO rule_node_ref (node_key, law_key, mst, article_no, ref_order)
VALUES
('coverage.root','LAW_ARCH_RULE','276927','제21조',3);