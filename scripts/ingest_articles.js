import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const OUT_DIR = path.resolve("./data");
const DUMP_FILE = path.resolve("./data/law_article_dump.json");
const SQL_FILE = path.resolve("./data/law_article_insert.sql");

const LAW_OC = process.env.LAW_OC;
const LAW_ID = process.env.LAW_ID; // 우리가 넘기는 값(대부분 MST)
const LIMIT = Number(process.env.LIMIT || 200);
const DRY_RUN = process.env.DRY_RUN === "1";

const BASE_URL = "http://www.law.go.kr/DRF/lawService.do";

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}
function escSql(x) {
  return String(x ?? "").replace(/'/g, "''");
}
function stripHtml(s) {
  return String(s ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-article-ingestor/1.0",
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

// ===== 조문 찾기: 응답 구조가 다양해서 "조문" 배열을 최대한 안전하게 찾는다 =====
function getLawServiceRoot(data) {
  // 대표 키 후보들
  return (
    data?.LawService ||
    data?.lawService ||
    data?.["현행법령"] ||
    data?.["현행법령정보"] ||
    data
  );
}

function findArticlesArray(data) {
  const root = getLawServiceRoot(data);

  // 가장 흔한 구조 후보:
  // root.조문.조문단위 또는 root.조문 or root["조문"]
  const candidates = [
    root?.조문?.조문단위,
    root?.조문,
    root?.["조문"],
    root?.["조문단위"],
    root?.Article,
    root?.article,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  // 그래도 못 찾으면 재귀로 "조문번호/조문내용" 포함 객체들을 모은다
  const out = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!node || typeof node !== "object") return;

    // 조문 객체로 추정
    if (
      ("조문번호" in node || "조문번호문자열" in node) &&
      ("조문내용" in node || "조문내용HTML" in node || "내용" in node)
    ) {
      out.push(node);
      return;
    }

    for (const v of Object.values(node)) walk(v);
  };
  walk(root);
  return out;
}

function normalizeArticles(raw, lawIdKey, sourceUrl) {
  const rows = [];
  for (const it of raw || []) {
    const no = it["조문번호"] || it["조문번호문자열"] || it["조문"] || "";
    let article_no = String(no).trim();
    if (article_no && /^\d+$/.test(article_no)) article_no = `제${article_no}조`;
    if (!article_no) continue;

    const title = String(it["조문제목"] || it["제목"] || "").trim();
    const bodyRaw = it["조문내용"] || it["내용"] || it["조문내용HTML"] || "";
    const body = stripHtml(bodyRaw);
    if (!body) continue;

    rows.push({
      law_id: String(lawIdKey),
      article_no,
      title,
      body,
      source_url: sourceUrl || "",
    });
  }

  // 중복 제거
  const map = new Map();
  for (const r of rows) map.set(`${r.law_id}__${r.article_no}`, r);
  return Array.from(map.values());
}

function buildInsertSQL(rows) {
  return rows
    .map((r) => {
      return `INSERT OR IGNORE INTO law_article (law_id, article_no, title, body, source_url)
VALUES ('${escSql(r.law_id)}','${escSql(r.article_no)}','${escSql(r.title)}','${escSql(
        r.body
      )}','${escSql(r.source_url)}');`;
    })
    .join("\n");
}

async function requestWith(paramKey) {
  const u = new URL(BASE_URL);
  u.searchParams.set("OC", LAW_OC);
  u.searchParams.set("target", "eflaw");
  u.searchParams.set("type", "JSON");
  u.searchParams.set(paramKey, LAW_ID); // ✅ ID 또는 MST
  const sourceUrl = u.toString();

  console.log(`- 요청(${paramKey})`, sourceUrl);

  const { status, url, text } = await fetchText(sourceUrl);
  const data = safeJsonParse(text);

  if (!data) {
    console.log(`  ⚠️ JSON 아님(status=${status}). 앞부분: ${text.slice(0, 80)}`);
    return { ok: false, paramKey, status, url, text, data: null, sourceUrl };
  }

  const rawArticles = findArticlesArray(data);
  let rows = normalizeArticles(rawArticles, LAW_ID, sourceUrl);
  if (Number.isFinite(LIMIT) && LIMIT > 0) rows = rows.slice(0, LIMIT);

  return { ok: true, paramKey, rows, data, sourceUrl };
}

async function run() {
  ensureOutDir();

  if (!LAW_OC) throw new Error("LAW_OC가 비어있습니다. 예) LAW_OC=dudy3038");
  if (!LAW_ID) throw new Error("LAW_ID가 비어있습니다. 예) LAW_ID=276925");

  console.log("📡 조문 원문 수집 시작");
  console.log(`- LAW_ID=${LAW_ID} LIMIT=${LIMIT}`);

  // ✅ 1) MST 우선 시도 → 2) ID로 재시도
  const r1 = await requestWith("MST");
  let rows = r1.ok ? r1.rows : [];

  if (rows.length === 0) {
    console.log("… MST로 0건 → ID로 재시도");
    const r2 = await requestWith("ID");
    rows = r2.ok ? r2.rows : [];
  }

  console.log(`✔ 최종 조문 추출: ${rows.length}건`);

  fs.writeFileSync(DUMP_FILE, JSON.stringify(rows, null, 2), "utf-8");
  console.log(`✔ dump 저장: ${DUMP_FILE}`);

  const sql = buildInsertSQL(rows);
  fs.writeFileSync(SQL_FILE, sql, "utf-8");
  console.log(`✔ INSERT SQL 생성: ${SQL_FILE}`);

  if (DRY_RUN) {
    console.log("🧪 DRY_RUN=1 이라 DB 반영 생략");
    return;
  }

  console.log("📦 원격 D1에 INSERT 실행 (--remote)");
  execSync(`npx wrangler d1 execute archi_law_db --file=${SQL_FILE} --remote`, {
    stdio: "inherit",
  });

  console.log("🎯 DB 반영 완료");
}

run().catch((e) => {
  console.error("❌ ingest:articles 실패:", e?.message || e);
  process.exitCode = 1;
});
