INSERT INTO law (law_key, law_name, ministry)
VALUES ('014877','12ㆍ29여객기참사 피해구제 및 지원 등을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('270935','014877','2025-06-30','2025-04-29','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=270935&type=HTML&mobileYn=&efYd=20250630');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014899','12ㆍ29여객기참사 피해구제 및 지원 등을 위한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('281237','014899','2026-01-02','2025-12-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=281237&type=HTML&mobileYn=&efYd=20260102');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014899','12ㆍ29여객기참사 피해구제 및 지원 등을 위한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('272537','014899','2025-06-30','2025-06-25','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=272537&type=HTML&mobileYn=&efYd=20250630');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('011726','2015세계물포럼 지원 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('137096','011726','2013-03-23','2013-03-23','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=137096&type=HTML&mobileYn=&efYd=20130323');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('011726','2015세계물포럼 지원 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('130863','011726','2013-03-19','2012-12-18','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=130863&type=HTML&mobileYn=&efYd=20130319');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('011726','2015세계물포럼 지원 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('130863','011726','2012-12-18','2012-12-18','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=130863&type=HTML&mobileYn=&efYd=20121218');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('011776','2015세계물포럼 지원 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('184614','011776','2016-07-07','2016-07-06','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=184614&type=HTML&mobileYn=&efYd=20160707');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('011776','2015세계물포럼 지원 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('133096','011776','2013-03-19','2013-03-18','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=133096&type=HTML&mobileYn=&efYd=20130319');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014518','가덕도신공항건설공단법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('255405','014518','2024-04-25','2023-10-24','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=255405&type=HTML&mobileYn=&efYd=20240425');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014647','가덕도신공항건설공단법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('262103','014647','2024-04-25','2024-04-25','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=262103&type=HTML&mobileYn=&efYd=20240425');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014641','가덕도신공항건설공단법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('261795','014641','2024-04-25','2024-04-16','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=261795&type=HTML&mobileYn=&efYd=20240425');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('280063','014035','2026-03-03','2025-12-02','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=280063&type=HTML&mobileYn=&efYd=20260303');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('276917','014035','2026-01-02','2025-10-01','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=276917&type=HTML&mobileYn=&efYd=20260102');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('258303','014035','2024-01-09','2024-01-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=258303&type=HTML&mobileYn=&efYd=20240109');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('257375','014035','2023-12-26','2023-12-26','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=257375&type=HTML&mobileYn=&efYd=20231226');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('250945','014035','2023-11-17','2023-05-16','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=250945&type=HTML&mobileYn=&efYd=20231117');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('246645','014035','2023-06-28','2022-12-27','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=246645&type=HTML&mobileYn=&efYd=20230628');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('250009','014035','2023-04-18','2023-04-18','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=250009&type=HTML&mobileYn=&efYd=20230418');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('236979','014035','2022-12-01','2021-11-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=236979&type=HTML&mobileYn=&efYd=20221201');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014035','가덕도신공항 건설을 위한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('230203','014035','2021-09-17','2021-03-16','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=230203&type=HTML&mobileYn=&efYd=20210917');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014155','가덕도신공항 건설을 위한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('235695','014155','2021-09-17','2021-09-17','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=235695&type=HTML&mobileYn=&efYd=20210917');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014145','가덕도신공항 건설을 위한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('281239','014145','2026-01-02','2025-12-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=281239&type=HTML&mobileYn=&efYd=20260102');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014145','가덕도신공항 건설을 위한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('256475','014145','2023-12-12','2023-12-12','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=256475&type=HTML&mobileYn=&efYd=20231212');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014145','가덕도신공항 건설을 위한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('255957','014145','2023-11-17','2023-11-07','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=255957&type=HTML&mobileYn=&efYd=20231117');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('014145','가덕도신공항 건설을 위한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('235431','014145','2021-09-17','2021-09-14','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=235431&type=HTML&mobileYn=&efYd=20210917');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('276919','012071','2026-01-02','2025-10-01','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=276919&type=HTML&mobileYn=&efYd=20260102');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('258089','012071','2024-07-10','2024-01-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=258089&type=HTML&mobileYn=&efYd=20240710');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('258305','012071','2024-01-09','2024-01-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=258305&type=HTML&mobileYn=&efYd=20240109');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('246647','012071','2023-06-28','2022-12-27','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=246647&type=HTML&mobileYn=&efYd=20230628');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('243069','012071','2022-12-11','2022-06-10','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=243069&type=HTML&mobileYn=&efYd=20221211');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('236981','012071','2022-12-01','2021-11-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=236981&type=HTML&mobileYn=&efYd=20221201');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('228491','012071','2022-01-13','2021-01-12','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=228491&type=HTML&mobileYn=&efYd=20220113');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('222507','012071','2021-04-21','2020-10-20','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=222507&type=HTML&mobileYn=&efYd=20210421');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('219187','012071','2020-06-09','2020-06-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=219187&type=HTML&mobileYn=&efYd=20200609');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('208471','012071','2019-05-24','2019-04-23','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=208471&type=HTML&mobileYn=&efYd=20190524');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('205835','012071','2019-03-19','2018-12-18','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=205835&type=HTML&mobileYn=&efYd=20190319');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('202661','012071','2019-03-14','2018-03-13','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=202661&type=HTML&mobileYn=&efYd=20190314');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('191046','012071','2018-01-18','2017-01-17','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=191046&type=HTML&mobileYn=&efYd=20180118');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('200200','012071','2017-12-26','2017-12-26','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=200200&type=HTML&mobileYn=&efYd=20171226');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('179597','012071','2017-01-20','2016-01-19','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=179597&type=HTML&mobileYn=&efYd=20170120');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('178180','012071','2016-06-30','2015-12-29','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=178180&type=HTML&mobileYn=&efYd=20160630');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012071','간선급행버스체계의 건설 및 운영에 관한 특별법','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('155143','012071','2014-12-04','2014-06-03','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=155143&type=HTML&mobileYn=&efYd=20141204');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('282021','012188','2025-12-26','2025-12-26','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=282021&type=HTML&mobileYn=&efYd=20251226');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('263891','012188','2024-07-10','2024-07-10','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=263891&type=HTML&mobileYn=&efYd=20240710');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('246055','012188','2022-12-11','2022-12-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=246055&type=HTML&mobileYn=&efYd=20221211');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('234955','012188','2021-08-27','2021-08-27','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=234955&type=HTML&mobileYn=&efYd=20210827');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('231841','012188','2021-04-21','2021-04-21','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=231841&type=HTML&mobileYn=&efYd=20210421');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('211013','012188','2019-10-14','2019-10-14','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=211013&type=HTML&mobileYn=&efYd=20191014');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('180568','012188','2016-01-27','2016-01-27','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=180568&type=HTML&mobileYn=&efYd=20160127');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012188','간선급행버스체계의 건설 및 운영에 관한 특별법 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('165188','012188','2014-12-10','2014-12-10','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=165188&type=HTML&mobileYn=&efYd=20141210');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('281241','012179','2026-01-02','2025-12-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=281241&type=HTML&mobileYn=&efYd=20260102');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('272901','012179','2025-07-22','2025-07-22','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=272901&type=HTML&mobileYn=&efYd=20250722');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('263857','012179','2024-07-10','2024-07-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=263857&type=HTML&mobileYn=&efYd=20240710');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('262243','012179','2024-05-17','2024-05-07','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=262243&type=HTML&mobileYn=&efYd=20240517');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('245751','012179','2022-12-11','2022-12-06','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=245751&type=HTML&mobileYn=&efYd=20221211');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('231641','012179','2021-04-21','2021-04-20','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=231641&type=HTML&mobileYn=&efYd=20210421');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('228859','012179','2021-01-26','2021-01-26','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=228859&type=HTML&mobileYn=&efYd=20210126');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('227121','012179','2021-01-05','2021-01-05','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=227121&type=HTML&mobileYn=&efYd=20210105');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('223947','012179','2020-12-10','2020-12-08','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=223947&type=HTML&mobileYn=&efYd=20201210');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('208081','012179','2019-03-19','2019-03-19','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=208081&type=HTML&mobileYn=&efYd=20190319');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('204685','012179','2018-12-29','2018-09-28','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=204685&type=HTML&mobileYn=&efYd=20181229');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('192816','012179','2017-03-30','2017-03-27','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=192816&type=HTML&mobileYn=&efYd=20170330');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('184297','012179','2016-06-30','2016-06-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=184297&type=HTML&mobileYn=&efYd=20160630');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('180057','012179','2016-01-25','2016-01-22','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=180057&type=HTML&mobileYn=&efYd=20160125');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012179','간선급행버스체계의 건설 및 운영에 관한 특별법 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('164542','012179','2014-12-04','2014-12-03','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=164542&type=HTML&mobileYn=&efYd=20141204');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('250715','012481','2023-08-10','2023-05-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=250715&type=HTML&mobileYn=&efYd=20230810');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('234029','012481','2022-07-21','2021-07-20','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=234029&type=HTML&mobileYn=&efYd=20220721');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('234029','012481','2022-01-21','2021-07-20','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=234029&type=HTML&mobileYn=&efYd=20220121');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('219355','012481','2020-12-10','2020-06-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=219355&type=HTML&mobileYn=&efYd=20201210');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('217305','012481','2020-07-08','2020-04-07','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=217305&type=HTML&mobileYn=&efYd=20200708');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('219189','012481','2020-06-09','2020-06-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=219189&type=HTML&mobileYn=&efYd=20200609');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('210180','012481','2020-02-21','2019-08-20','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=210180&type=HTML&mobileYn=&efYd=20200221');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('198543','012481','2018-11-01','2017-10-31','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=198543&type=HTML&mobileYn=&efYd=20181101');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('199154','012481','2018-05-29','2017-11-28','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=199154&type=HTML&mobileYn=&efYd=20180529');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('202782','012481','2018-03-20','2018-03-20','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=202782&type=HTML&mobileYn=&efYd=20180320');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('181858','012481','2016-09-01','2016-03-22','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=181858&type=HTML&mobileYn=&efYd=20160901');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012481','감정평가 및 감정평가사에 관한 법률','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('179795','012481','2016-09-01','2016-01-19','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=179795&type=HTML&mobileYn=&efYd=20160901');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('265653','012655','2024-09-26','2024-09-26','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=265653&type=HTML&mobileYn=&efYd=20240926');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('256837','012655','2023-12-08','2023-12-08','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=256837&type=HTML&mobileYn=&efYd=20231208');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('241617','012655','2022-03-30','2022-03-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=241617&type=HTML&mobileYn=&efYd=20220330');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('239827','012655','2022-01-21','2022-01-21','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=239827&type=HTML&mobileYn=&efYd=20220121');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('234957','012655','2021-08-27','2021-08-27','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=234957&type=HTML&mobileYn=&efYd=20210827');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('224141','012655','2020-12-10','2020-12-11','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=224141&type=HTML&mobileYn=&efYd=20201210');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('214851','012655','2020-02-21','2020-02-21','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=214851&type=HTML&mobileYn=&efYd=20200221');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('202142','012655','2018-02-09','2018-02-09','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=202142&type=HTML&mobileYn=&efYd=20180209');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('190703','012655','2016-12-30','2016-12-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=190703&type=HTML&mobileYn=&efYd=20161230');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012655','감정평가 및 감정평가사에 관한 법률 시행규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('186094','012655','2016-09-01','2016-08-31','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=186094&type=HTML&mobileYn=&efYd=20160901');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('265547','012651','2024-09-26','2024-09-26','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=265547&type=HTML&mobileYn=&efYd=20240926');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('264999','012651','2024-08-20','2024-08-20','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=264999&type=HTML&mobileYn=&efYd=20240820');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('239579','012651','2022-01-21','2022-01-21','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=239579&type=HTML&mobileYn=&efYd=20220121');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('227123','012651','2021-01-05','2021-01-05','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=227123&type=HTML&mobileYn=&efYd=20210105');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('223877','012651','2020-12-10','2020-12-08','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=223877&type=HTML&mobileYn=&efYd=20201210');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('222913','012651','2020-11-24','2020-11-24','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=222913&type=HTML&mobileYn=&efYd=20201124');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('221151','012651','2020-08-28','2020-08-26','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=221151&type=HTML&mobileYn=&efYd=20200828');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('214661','012651','2020-02-21','2020-02-18','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=214661&type=HTML&mobileYn=&efYd=20200221');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('205070','012651','2018-11-01','2018-10-30','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=205070&type=HTML&mobileYn=&efYd=20181101');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('204935','012651','2018-10-23','2018-10-23','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=204935&type=HTML&mobileYn=&efYd=20181023');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('012651','감정평가 및 감정평가사에 관한 법률 시행령','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('185871','012651','2016-09-01','2016-08-31','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=185871&type=HTML&mobileYn=&efYd=20160901');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('006140','감정평가에 관한 규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('254883','006140','2023-09-14','2023-09-14','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=254883&type=HTML&mobileYn=&efYd=20230914');
INSERT INTO law (law_key, law_name, ministry)
VALUES ('006140','감정평가에 관한 규칙','국토교통부')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');
INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('239765','006140','2022-01-21','2022-01-21','http://www.law.go.kr/DRF/lawService.do?OC=dudy3038&target=eflaw&MST=239765&type=HTML&mobileYn=&efYd=20220121');