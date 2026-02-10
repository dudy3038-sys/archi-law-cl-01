INSERT OR IGNORE INTO law_meta (law_id, law_name, ministry, 시행일, source_url)
VALUES
('SAMPLE_LAW_001', '샘플법(테스트)', '샘플부처', '2026-01-01', 'https://example.com');

INSERT OR IGNORE INTO law_article (law_id, article_no, title, body, source_url)
VALUES
('SAMPLE_LAW_001', '제1조', '목적', '이 법은 테스트를 위한 샘플 조문입니다.', 'https://example.com/article1');

INSERT INTO rule_map (rule_key, rule_desc, match_json, targets_json)
VALUES
('floors_ge_3', '지상층수 3층 이상이면 피난/방화 관련 체크', '{"floors": {"$gte": 3}}', '{"laws":[{"law_id":"SAMPLE_LAW_001","articles":["제1조"]}]}');
