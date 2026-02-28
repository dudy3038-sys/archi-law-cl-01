// scripts/ingest_meta.js (FULL REPLACE)
// 정공법 v4
// - FORCE_LAW_NAMES(정확 법령명)만 수집
// - lawSearch 검색 결과에서 "법령명 완전일치"만 채택
// - q/query/search 키를 모두 시도
// - 검색이 동작하지 않으면(=완전일치가 하나도 안 나오면) 즉시 실패 처리
// - 필요 시 RESET_META=1 로 law/law_version만 초기화 가능

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const OUT_DIR = path.resolve("./data");
const DB_FILE = path.resolve("./data/law_meta_dump.json");
const SQL_FILE = path.resolve("./data/law_meta_insert.sql");

const BASE_URL = "http://www.law.go.kr/DRF/lawSearch.do";

const LAW_OC = process.env.LAW_OC;

const DISPLAY = Number(process.env.DISPLAY || 100);
const MAX_PAGES = Number(process.env.MAX_PAGES || 5);

// ✅ "정확한 법령명"만 수집 (필요하면 여기만 추가/삭제)
const FORCE_LAW_NAMES = [
  "국토의 계획 및 이용에 관한 법률",
  "국토의 계획 및 이용에 관한 법률 시행령",
  "국토의 계획 및 이용에 관한 법률 시행규칙",

  "주차장법",
  "주차장법 시행령",
  "주차장법 시행규칙",
  "주차장법시행령",       // ✅ 추가
  "주차장법시행규칙",     // ✅ 추가

  "건축법",
  "건축법 시행령",
  "건축법 시행규칙",
  "건축법시행령",         // ✅ 추가(혹시 공백 없이 오는 경우 대비)
  "건축법시행규칙",       // ✅ 추가
];

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

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
      "user-agent": "archi-law-meta-ingestor/4.0",
      accept: "application/json,text/plain,*/*",
    },
  });
  const text = await res.text();
  return { status: res.status, url: res.url, text };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickItems(data) {
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

function normalizeRows(items) {
  return (items || [])
    .map((it) => {
      const lawName = it["법령명한글"] || it["법령명"] || it["lawName"] || "";
      const lawKey = (it["법령ID"] ?? it["lawId"] ?? "").toString().trim();
      const mst = (it["MST"] ?? it["법령일련번호"] ?? it["lawSeq"] ?? "")
        .toString()
        .trim();
      const ministry = (it["소관부처명"] || it["소관부처"] || "").toString().trim();

      const effISO = yyyymmddToISO(it["시행일자"] || it["시행일"] || "");
      const pubISO = yyyymmddToISO(it["공포일자"] || it["공포일"] || "");

      const link = toAbsLawGoUrl(
        it["법령상세링크"] || it["법령상세링크URL"] || it["법령링크"] || ""
      );

      if (!lawName) return null;
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

function dedupeRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = `${r.law_key}__${r.mst}`;
    if (!map.has(k)) map.set(k, r);
  }
  return Array.from(map.values());
}

function saveDump(rows) {
  ensureOutDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
  console.log(`✔ dump 저장 완료: ${DB_FILE} (${rows.length}건)`);
}

function buildInsertSQL(rows) {
  const lines = [];
  for (const r of rows) {
    lines.push(
      `INSERT INTO law (law_key, law_name, ministry)
VALUES ('${esc(r.law_key)}','${esc(r.law_name)}','${esc(r.ministry)}')
ON CONFLICT(law_key) DO UPDATE SET
  law_name=excluded.law_name,
  ministry=excluded.ministry,
  updated_at=datetime('now');`
    );

    lines.push(
      `INSERT OR IGNORE INTO law_version (mst, law_key, 시행일, 공포일, source_url)
VALUES ('${esc(r.mst)}','${esc(r.law_key)}','${esc(r.시행일)}','${esc(r.공포일)}','${esc(
        r.source_url
      )}');`
    );
  }
  return lines.join("\n");
}

function buildSearchUrl({ q, page, keyMode }) {
  const u = new URL(BASE_URL);
  u.searchParams.set("OC", String(LAW_OC));
  u.searchParams.set("target", "eflaw");
  u.searchParams.set("type", "JSON");
  u.searchParams.set("display", String(DISPLAY));
  u.searchParams.set("page", String(page));

  // ✅ 검색 키를 여러 방식으로 시도 (환경 따라 먹는 키가 다름)
  // keyMode: "q" | "query" | "search"
  if (keyMode === "q") u.searchParams.set("q", String(q));
  if (keyMode === "query") u.searchParams.set("query", String(q));
  if (keyMode === "search") u.searchParams.set("search", String(q));

  return u.toString();
}

async function fetchExactLawByName(lawName) {
  const keyModes = ["q", "query", "search"];
  const collected = [];

  for (const km of keyModes) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = buildSearchUrl({ q: lawName, page, keyMode: km });
      console.log(`\n🔎 [meta] EXACT "${lawName}" mode=${km} page=${page}`);
      console.log("🔎 요청 URL:", url);

      const { status, text } = await fetchText(url);

      const data = safeJsonParse(text);
      if (!data) {
        console.log("⚠️ JSON 파싱 실패(앞 120자):", text.slice(0, 120));
        break;
      }

      const items = pickItems(data);
      const rows = normalizeRows(items);

      if (!rows.length) {
        console.log(`ℹ️ 결과 0건 → "${lawName}" (mode=${km}) 종료`);
        break;
      }

      // ✅ 완전일치만 채택
      const exact = rows.filter((r) => r.law_name === lawName);

      console.log(`- raw=${rows.length} exact=${exact.length} (status=${status})`);
      collected.push(...exact);

      // 완전일치가 이미 나오면 더 뒤 페이지 볼 필요 없음
      if (exact.length) break;
    }

    if (collected.length) break; // 어떤 mode에서든 찾으면 종료
  }

  return collected;
}

function resetMetaIfNeeded() {
  if (process.env.RESET_META !== "1") return;

  console.log("\n🧨 RESET_META=1 → law_version / law 테이블 정리(메타만)");
  execSync(
    `npx wrangler d1 execute archi_law_db --remote --command="DELETE FROM law_version;"`,
    { stdio: "inherit" }
  );
  execSync(
    `npx wrangler d1 execute archi_law_db --remote --command="DELETE FROM law;"`,
    { stdio: "inherit" }
  );
  console.log("🧨 메타 초기화 완료");
}

async function run() {
  console.log("📡 법령 목록(메타) 수집 시작 (정공법: 정확 법령명만)");
  if (!LAW_OC) throw new Error("환경변수 LAW_OC가 비어있습니다. 예) LAW_OC=dudy3038");

  console.log(`- DISPLAY=${DISPLAY}`);
  console.log(`- MAX_PAGES=${MAX_PAGES}`);
  console.log(`- FORCE_LAW_NAMES=${FORCE_LAW_NAMES.length}개`);

  resetMetaIfNeeded();

  let rows = [];

  for (const name of FORCE_LAW_NAMES) {
    const found = await fetchExactLawByName(name);
    if (!found.length) {
      console.log(`\n❌ FAIL: "${name}" 를 lawSearch에서 찾지 못했습니다.`);
      console.log(
        "   - 원인 후보: lawSearch가 검색 파라미터를 무시하거나, OC 권한/정책/응답 구조 문제"
      );
      console.log("   - 해결: DEBUG_RAW처럼 응답 앞부분을 확인하거나, 파라미터 키를 추가 확장 필요");
      // 정공법: 하나라도 못 찾으면 멈추는 게 안전
      return;
    }
    rows.push(...found);
  }

  rows = dedupeRows(rows);

  if (!rows.length) {
    console.log("\n❌ 최종 0건입니다.");
    return;
  }

  rows.sort((a, b) => (a.law_name || "").localeCompare(b.law_name || "", "ko"));

  saveDump(rows);

  const sql = buildInsertSQL(rows);
  fs.writeFileSync(SQL_FILE, sql, "utf-8");
  console.log(`✔ INSERT SQL 생성: ${SQL_FILE}`);

  console.log("📦 원격 D1에 INSERT 실행 (--remote)");
  execSync(`npx wrangler d1 execute archi_law_db --file=${SQL_FILE} --remote`, {
    stdio: "inherit",
  });

  console.log("🎯 DB 반영 완료 (메타 v2)");

  const uniqLaw = new Set(rows.map((r) => r.law_key)).size;
  const uniqVer = new Set(rows.map((r) => r.mst)).size;
  console.log(`📌 요약: law_key ${uniqLaw}개, mst ${uniqVer}개`);
  console.log("\n✅ 다음: DB에서 국토계획법/주차장법/건축법 law_key가 제대로 들어갔는지 확인 후 ingest:articles 진행");
}

run().catch((e) => {
  console.error("❌ ingest:meta 실패:", e?.message || e);
  process.exitCode = 1;
});