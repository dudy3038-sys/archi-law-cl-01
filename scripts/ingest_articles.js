// scripts/ingest_articles.js (FULL REPLACE - SAFE VERSION)

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const OUT_DIR = path.resolve("./data");
const PART_DIR = path.resolve("./data/law_article_sql_parts");
const DUMP_FILE = path.resolve("./data/law_article_dump.json");
const RAW_FILE = path.resolve("./data/law_article_raw_response.txt");

const LAW_OC = process.env.LAW_OC;
const LAW_KEYS = String(process.env.LAW_KEYS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ON_DATE = String(process.env.ON_DATE || "").trim();
const LIMIT = Number(process.env.LIMIT || 0);
const DRY_RUN = process.env.DRY_RUN === "1";
const DEBUG_RAW = process.env.DEBUG_RAW === "1";
const SQL_CHUNK_SIZE = Number(process.env.SQL_CHUNK_SIZE || 200);

const DB_NAME = "archi_law_db";
const BASE_URL = "http://www.law.go.kr/DRF/lawService.do";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function extractArticleNoFromBody(body) {
  const m = body.match(/^제\d+조(?:의\d+)?/);
  return m ? m[0] : null;
}

function isDeletedArticle(body) {
  const t = body.trim();
  return /삭제$/.test(t);
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "archi-law-article-ingestor/4.0",
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

function getLawServiceRoot(data) {
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
  return [];
}

function normalizeArticles(raw, lawKey, mst, sourceUrl) {
  const rows = [];

  for (const it of raw || []) {
    const bodyRaw = it["조문내용"] || it["내용"] || it["조문내용HTML"] || "";
    const body = stripHtml(bodyRaw);
    if (!body) continue;

    // 🔴 삭제 조문 필터
    if (isDeletedArticle(body)) continue;

    let article_no =
      it["조문번호"] || it["조문번호문자열"] || it["조문"] || "";

    article_no = String(article_no).trim();

    // 🔴 body 기준 조문번호 재정규화
    const extracted = extractArticleNoFromBody(body);
    if (extracted) article_no = extracted;

    if (!article_no) continue;

    let title = String(it["조문제목"] || it["제목"] || "").trim();

    // 🟡 title fallback
    if (!title) title = article_no;

    rows.push({
      law_key: String(lawKey),
      mst: String(mst),
      article_no,
      title,
      body,
      source_url: sourceUrl || "",
    });
  }

  const map = new Map();
  for (const r of rows) {
    map.set(`${r.law_key}__${r.mst}__${r.article_no}`, r);
  }
  return Array.from(map.values());
}

function resolveLatestMstFromDB(lawKey, onDateISO) {
  const dt = onDateISO || todayISO();
  const cmd =
    `npx wrangler d1 execute ${DB_NAME} --remote --command=` +
    `"SELECT mst FROM law_version WHERE law_key='${escSql(
      lawKey
    )}' AND (시행일 IS NULL OR 시행일 = '' OR 시행일 <= '${escSql(
      dt
    )}') ORDER BY CASE WHEN (시행일 IS NULL OR 시행일 = '') THEN 0 ELSE 1 END DESC, 시행일 DESC, mst DESC LIMIT 1;"`;

  const out = execSync(cmd, { encoding: "utf-8" });
  const m = out.match(/"mst"\s*:\s*"([^"]+)"/);
  return m ? m[1] : "";
}

async function requestLawService(mst) {
  const u = new URL(BASE_URL);
  u.searchParams.set("OC", LAW_OC);
  u.searchParams.set("target", "eflaw");
  u.searchParams.set("type", "JSON");
  u.searchParams.set("MST", mst);

  const { status, url, text } = await fetchText(u.toString());

  if (DEBUG_RAW) {
    ensureDir(OUT_DIR);
    fs.writeFileSync(RAW_FILE, text, "utf-8");
  }

  const data = safeJsonParse(text);
  if (!data) {
    throw new Error(`법제처 응답 JSON 아님 status=${status}`);
  }

  return { data, sourceUrl: url };
}

function buildInsertLine(r) {
  return `
INSERT INTO law_article (law_key, mst, article_no, title, body, source_url, updated_at)
VALUES ('${escSql(r.law_key)}','${escSql(r.mst)}','${escSql(
    r.article_no
  )}','${escSql(r.title)}','${escSql(r.body)}','${escSql(
    r.source_url
  )}', datetime('now'))
ON CONFLICT(law_key, mst, article_no)
DO UPDATE SET
  title=excluded.title,
  body=excluded.body,
  source_url=excluded.source_url,
  updated_at=datetime('now');
`;
}

function writeChunkedSQL(rows) {
  ensureDir(PART_DIR);

  for (const f of fs.readdirSync(PART_DIR)) {
    if (f.endsWith(".sql")) fs.unlinkSync(path.join(PART_DIR, f));
  }

  const lines = rows.map(buildInsertLine);

  const parts = [];
  for (let i = 0; i < lines.length; i += SQL_CHUNK_SIZE) {
    const filename = path.join(
      PART_DIR,
      `law_article_part_${String(parts.length + 1).padStart(3, "0")}.sql`
    );
    fs.writeFileSync(
      filename,
      lines.slice(i, i + SQL_CHUNK_SIZE).join("\n"),
      "utf-8"
    );
    parts.push(filename);
  }

  return parts;
}

function applyPartsRemote(parts) {
  for (const p of parts) {
    execSync(`npx wrangler d1 execute ${DB_NAME} --file=${p} --remote`, {
      stdio: "inherit",
    });
  }
}

async function run() {
  ensureDir(OUT_DIR);

  if (!LAW_OC) throw new Error("LAW_OC 비어있음");
  if (!LAW_KEYS.length) throw new Error("LAW_KEYS 비어있음");

  const dt = ON_DATE || todayISO();
  const allRows = [];

  for (const lawKey of LAW_KEYS) {
    const mst = resolveLatestMstFromDB(lawKey, dt);
    if (!mst) continue;

    const { data, sourceUrl } = await requestLawService(mst);
    const raw = findArticlesArray(data);

    let rows = normalizeArticles(raw, lawKey, mst, sourceUrl);
    if (LIMIT > 0) rows = rows.slice(0, LIMIT);

    allRows.push(...rows);
  }

  if (!allRows.length) {
    console.log("❌ 수집 결과 없음");
    return;
  }

  const map = new Map();
  for (const r of allRows) {
    map.set(`${r.law_key}__${r.mst}__${r.article_no}`, r);
  }
  const uniqueRows = Array.from(map.values());

  fs.writeFileSync(DUMP_FILE, JSON.stringify(uniqueRows, null, 2), "utf-8");

  const parts = writeChunkedSQL(uniqueRows);
  if (!DRY_RUN) applyPartsRemote(parts);

  console.log("🎯 ingest 완료");
}

run().catch((e) => {
  console.error("❌ ingest 실패:", e?.message || e);
  process.exitCode = 1;
});