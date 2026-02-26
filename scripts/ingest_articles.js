import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const OUT_DIR = path.resolve("./data");
const DUMP_FILE = path.resolve("./data/law_article_dump.json");
const SQL_FILE = path.resolve("./data/law_article_insert.sql");
const RAW_FILE = path.resolve("./data/law_article_raw_response.txt");

const LAW_OC = process.env.LAW_OC;
const MST = String(process.env.LAW_ID || "").trim(); // ✅ 우리가 넘기는 값 = MST로 사용
const LAW_KEY_ENV = String(process.env.LAW_KEY || "").trim(); // ✅ 선택: 법령ID(001823 등)
const LIMIT = Number(process.env.LIMIT || 0); // 0이면 제한 없음
const DRY_RUN = process.env.DRY_RUN === "1";
const DEBUG_RAW = process.env.DEBUG_RAW === "1";

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
      "user-agent": "archi-law-article-ingestor/2.0",
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

  // fallback: 재귀로 조문 객체 모으기
  const out = [];
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (!node || typeof node !== "object") return;

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

function normalizeArticles(raw, lawKey, mst, sourceUrl) {
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
      law_key: String(lawKey),
      mst: String(mst),
      article_no,
      title,
      body,
      source_url: sourceUrl || "",
    });
  }

  // 중복 제거 (law_key+mst+article_no)
  const map = new Map();
  for (const r of rows) map.set(`${r.law_key}__${r.mst}__${r.article_no}`, r);
  return Array.from(map.values());
}

// ✅ mst로 law_key를 DB에서 찾아내기 (LAW_KEY 안 줘도 동작)
function resolveLawKeyFromDB(envLawKey, mst) {
  if (envLawKey) return envLawKey;

  const cmd =
    `npx wrangler d1 execute archi_law_db --remote --command=` +
    `"SELECT law_key FROM law_version WHERE mst='${escSql(mst)}' LIMIT 1;"`;

  const out = execSync(cmd, { encoding: "utf-8" });

  // wrangler 출력은 JSON 형태로 나오므로, law_key 문자열만 대충 추출
  // (정확 파싱보다 안전하게: "law_key":"001823" 패턴 찾기)
  const m = out.match(/"law_key"\s*:\s*"([^"]+)"/);
  if (!m) {
    throw new Error(
      `mst=${mst}에 대한 law_key를 DB에서 찾지 못했습니다. (먼저 ingest:meta로 law_version을 채워야 합니다)`
    );
  }
  return m[1];
}

function buildInsertSQL(rows) {
  return rows
    .map((r) => {
      return `INSERT OR IGNORE INTO law_article (law_key, mst, article_no, title, body, source_url)
VALUES ('${escSql(r.law_key)}','${escSql(r.mst)}','${escSql(r.article_no)}','${escSql(
        r.title
      )}','${escSql(r.body)}','${escSql(r.source_url)}');`;
    })
    .join("\n");
}

async function requestLawService(mst) {
  const u = new URL(BASE_URL);
  u.searchParams.set("OC", LAW_OC);
  u.searchParams.set("target", "eflaw");
  u.searchParams.set("type", "JSON");
  u.searchParams.set("MST", mst); // ✅ MST로 고정
  const sourceUrl = u.toString();

  console.log(`- 요청(MST) ${sourceUrl}`);
  const { status, url, text } = await fetchText(sourceUrl);

  if (DEBUG_RAW) {
    fs.writeFileSync(RAW_FILE, text, "utf-8");
    console.log(`🧪 DEBUG_RAW=1 → raw 저장: ${RAW_FILE}`);
  }

  const data = safeJsonParse(text);
  if (!data) {
    throw new Error(
      `법제처 응답이 JSON이 아닙니다(status=${status}). 앞부분: ${text.slice(0, 120)}`
    );
  }

  return { data, sourceUrl };
}

async function run() {
  ensureOutDir();

  if (!LAW_OC) throw new Error("LAW_OC가 비어있습니다. 예) LAW_OC=dudy3038");
  if (!MST) throw new Error("LAW_ID(MST)가 비어있습니다. 예) LAW_ID=276925");

  // ✅ LAW_KEY는 없으면 DB에서 mst로 찾아온다
  const lawKey = resolveLawKeyFromDB(LAW_KEY_ENV, MST);

  console.log("📡 조문 원문 수집 시작 (v2: law_key + mst)");
  console.log(`- law_key=${lawKey} mst=${MST} LIMIT=${LIMIT || "no-limit"}`);

  const { data, sourceUrl } = await requestLawService(MST);
  const rawArticles = findArticlesArray(data);

  let rows = normalizeArticles(rawArticles, lawKey, MST, sourceUrl);
  if (Number.isFinite(LIMIT) && LIMIT > 0) rows = rows.slice(0, LIMIT);

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