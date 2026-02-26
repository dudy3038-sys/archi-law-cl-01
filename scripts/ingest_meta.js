import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DB_FILE = path.resolve("./data/law_meta_dump.json");
const SQL_FILE = path.resolve("./data/law_meta_insert.sql");

// law.go.kr DRF search endpoint
const BASE_URL = "http://www.law.go.kr/DRF/lawSearch.do";

// env
const LAW_OC = process.env.LAW_OC;
const ONLY_MOLIT = process.env.ONLY_MOLIT === "1";
const MOLIT_ORG = "1613000";

// fetch size (1 page only for now)
const DISPLAY = 100;

function yyyymmddToISO(yyyymmdd) {
  const s = String(yyyymmdd || "").trim();
  if (!/^\d{8}$/.test(s)) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function esc(x) {
  return String(x ?? "").replace(/'/g, "''");
}

function toAbsLawGoUrl(link) {
  const s = String(link || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `http://www.law.go.kr${s}`;
  return `http://www.law.go.kr/${s}`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-meta-ingestor/2.0",
      accept: "application/json,text/plain,*/*",
    },
  });
  const text = await res.text();
  return { status: res.status, url: res.url, text };
}

function pickItems(data) {
  // 가능한 응답 구조들을 넓게 커버
  return (
    data?.["현행법령목록"] ||
    data?.["eflaw"] ||
    data?.["law"] ||
    data?.["Law"] ||
    data?.["list"] ||
    data?.["items"] ||
    data?.["LawSearch"]?.["law"] ||
    []
  );
}

/**
 * v2 rows:
 * - law_key: 법령ID (예: 001823)
 * - mst: 버전 식별자 (보통 MST 또는 법령일련번호)
 * - law_name, ministry
 * - 시행일, 공포일
 * - source_url (상세 링크)
 */
function normalizeRows(items) {
  return (items || [])
    .map((it) => {
      const lawName = it["법령명한글"] || it["법령명"] || it["lawName"] || "";
      const lawKey = (it["법령ID"] ?? it["lawId"] ?? "").toString().trim(); // ✅ v2 핵심
      const mst = (it["MST"] ?? it["법령일련번호"] ?? it["lawSeq"] ?? "").toString().trim(); // ✅ 버전
      const ministry = (it["소관부처명"] || it["소관부처"] || "").toString().trim();

      const effISO = yyyymmddToISO(it["시행일자"] || it["시행일"] || "");
      const pubISO = yyyymmddToISO(it["공포일자"] || it["공포일"] || "");

      const link = toAbsLawGoUrl(it["법령상세링크"] || it["법령상세링크URL"] || it["법령링크"] || "");

      if (!lawName) return null;

      // law_key 또는 mst가 비면 v2 저장 의미가 없음
      if (!lawKey || !mst) return null;

      return {
        law_key: lawKey,
        mst,
        law_name: String(lawName).trim(),
        ministry,
        시행일: effISO,
        공포일: pubISO,
        source_url: link,
      };
    })
    .filter(Boolean);
}

function saveDump(rows) {
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
  console.log(`✔ dump 저장 완료: ${DB_FILE} (${rows.length}건)`);
}

/**
 * v2 insert:
 * - law: upsert(법령명/부처 갱신)
 * - law_version: insert ignore(버전 누적)
 */
function buildInsertSQL(rows) {
  const lines = [];

  for (const r of rows) {
    // law: 최신 이름/부처로 갱신 (UPSERT)
    lines.push(
      `INSERT INTO law (law_key, law_name, ministry)
VALUES ('${esc(r.law_key)}','${esc(r.law_name)}','${esc(r.ministry)}')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');`
    );

    // law_version: 버전(MST) 누적 (이미 있으면 무시)
    lines.push(
      `INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('${esc(r.mst)}','${esc(r.law_key)}','${esc(r.시행일)}','${esc(r.공포일)}','${esc(r.source_url)}');`
    );
  }

  return lines.join("\n");
}

async function getLawListFromLawGo() {
  if (!LAW_OC) {
    throw new Error("환경변수 LAW_OC가 비어있습니다. 예) LAW_OC=dudy3038 npm run ingest:meta");
  }

  const u = new URL(BASE_URL);
  u.searchParams.set("OC", LAW_OC);
  u.searchParams.set("target", "eflaw");
  u.searchParams.set("type", "JSON");
  u.searchParams.set("display", String(DISPLAY));
  u.searchParams.set("page", "1");
  if (ONLY_MOLIT) u.searchParams.set("org", MOLIT_ORG);

  console.log("🔎 요청 URL:", u.toString());

  const { status, url, text } = await fetchText(u.toString());

  console.log("🔎 응답 status:", status);
  console.log("🔎 최종 URL:", url);
  console.log("🔎 응답 앞부분(200자):");
  console.log(text.slice(0, 200));

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON 파싱 실패. 응답이 JSON이 아닙니다. (앞부분: ${text.slice(0, 60)})`);
  }

  const items = pickItems(data);
  const rows = normalizeRows(items);
  return rows;
}

async function run() {
  console.log("📡 법령 목록(메타) 수집 시작 (v2: law / law_version)");
  console.log(`- ONLY_MOLIT=${ONLY_MOLIT ? "1(국토교통부만)" : "0(전체)"}`);
  console.log(`- DISPLAY=${DISPLAY} (현재 1페이지만)`);

  const rows = await getLawListFromLawGo();

  if (rows.length === 0) {
    console.log("⚠️ 1페이지에서 0건입니다. 응답 구조/파라미터를 확인해야 합니다.");
    return;
  }

  saveDump(rows);

  const sql = buildInsertSQL(rows);
  fs.writeFileSync(SQL_FILE, sql, "utf-8");
  console.log(`✔ INSERT SQL 생성: ${SQL_FILE}`);

  console.log("📦 원격 D1에 INSERT 실행 (--remote)");
  execSync(`npx wrangler d1 execute archi_law_db --file=${SQL_FILE} --remote`, {
    stdio: "inherit",
  });

  console.log("🎯 DB 반영 완료 (v2)");

  // 간단 요약(로컬 덤프 기준)
  const uniqLaw = new Set(rows.map((r) => r.law_key)).size;
  const uniqVer = new Set(rows.map((r) => r.mst)).size;
  console.log(`📌 요약: law_key ${uniqLaw}개, mst ${uniqVer}개 (이번 페이지 기준)`);
}

run().catch((e) => {
  console.error("❌ ingest:meta 실패:", e?.message || e);
  process.exitCode = 1;
});