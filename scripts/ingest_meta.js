import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const DB_FILE = path.resolve("./data/law_meta_dump.json");
const SQL_FILE = path.resolve("./data/law_meta_insert.sql");

const BASE_URL = "http://www.law.go.kr/DRF/lawSearch.do";
const LAW_OC = process.env.LAW_OC;
const ONLY_MOLIT = process.env.ONLY_MOLIT === "1";
const MOLIT_ORG = "1613000";
const DISPLAY = 100;

function makeLawIdFromLawGo(lawGoId, lawName) {
  if (lawGoId != null && String(lawGoId).trim() !== "") return String(lawGoId);
  return crypto.createHash("md5").update(String(lawName || "")).digest("hex").slice(0, 12);
}

function yyyymmddToISO(yyyymmdd) {
  const s = String(yyyymmdd || "").trim();
  if (!/^\d{8}$/.test(s)) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function esc(x) {
  return String(x ?? "").replace(/'/g, "''");
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-meta-ingestor/1.0",
      "accept": "application/json,text/plain,*/*"
    }
  });
  const text = await res.text();
  return { status: res.status, url: res.url, text, headers: res.headers };
}

function pickItems(data) {
  // 응답 구조는 케이스가 많아서 넓게 커버
  return (
    data?.["현행법령목록"] ||
    data?.["eflaw"] ||
    data?.["law"] ||
    data?.["Law"] ||
    data?.["list"] ||
    data?.["items"] ||
    data?.["LawSearch"]?.["law"] || // 케이스 대비
    []
  );
}

function normalizeRows(items) {
  return (items || [])
    .map((it) => {
      const lawName = it["법령명한글"] || it["법령명"] || it["lawName"] || "";
      const lawId = makeLawIdFromLawGo(it["법령ID"] ?? it["법령일련번호"] ?? it["lawId"], lawName);
      const ministry = it["소관부처명"] || it["소관부처"] || "";
      const eff = yyyymmddToISO(it["시행일자"] || it["시행일"] || "");
      const link = it["법령상세링크"] || it["법령상세링크URL"] || it["법령링크"] || "";

      if (!lawName) return null;
      return {
        law_id: String(lawId),
        law_name: String(lawName).trim(),
        ministry: String(ministry).trim(),
        시행일: eff,
        source_url: String(link).trim()
      };
    })
    .filter(Boolean);
}

function saveDump(rows) {
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
  console.log(`✔ dump 저장 완료: ${DB_FILE} (${rows.length}건)`);
}

function buildInsertSQL(rows) {
  const lines = [];
  for (const r of rows) {
    lines.push(
      `INSERT OR IGNORE INTO law_meta (law_id, law_name, ministry, 시행일, source_url)
VALUES ('${esc(r.law_id)}','${esc(r.law_name)}','${esc(r.ministry)}','${esc(r.시행일)}','${esc(r.source_url)}');`
    );
  }
  return lines.join("\n");
}

async function getLawListFromLawGo() {
  if (!LAW_OC) {
    throw new Error("환경변수 LAW_OC가 비어있습니다. 예) export LAW_OC=dudy3038");
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

  // JSON 파싱 시도
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    // 여기서 HTML이면 그대로 실패 원인 확정
    throw new Error(`JSON 파싱 실패. 응답이 JSON이 아닙니다. (앞부분: ${text.slice(0, 60)})`);
  }

  const items = pickItems(data);
  const rows = normalizeRows(items);

  // 일단 1페이지로만 진단
  return rows;
}

async function run() {
  console.log("📡 법령 목록(메타) 수집 시작");
  console.log(`- ONLY_MOLIT=${ONLY_MOLIT ? "1(국토교통부만)" : "0(전체)"}`);

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
    stdio: "inherit"
  });

  console.log("🎯 DB 반영 완료");
}

run().catch((e) => {
  console.error("❌ ingest:meta 실패:", e?.message || e);
  process.exitCode = 1;
});
