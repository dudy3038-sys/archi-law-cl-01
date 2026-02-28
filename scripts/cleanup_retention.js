import { execSync } from "child_process";

const DB = "archi_law_db";
const KEEP_YEARS = 3;

// 🔒 최신 mst 보호 + 최근 3년만 정리
function getCutoffDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - KEEP_YEARS);
  return d.toISOString().slice(0, 10);
}

function runSQL(sql) {
  return execSync(
    `npx wrangler d1 execute ${DB} --remote --command="${sql}"`,
    { encoding: "utf-8" }
  );
}

function extractMstList(text) {
  return [...text.matchAll(/"mst"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
}

async function run() {
  const cutoff = getCutoffDate();

  console.log("🧹 법령 버전 정리 시작");
  console.log("보관:", KEEP_YEARS, "년");
  console.log("삭제 기준 시행일 <", cutoff);

  // 🔴 1. 최신 mst 보호 목록 확보 (law_key별 최신)
  const latestSQL = `
SELECT mst FROM (
  SELECT mst,
         ROW_NUMBER() OVER (PARTITION BY law_key ORDER BY 시행일 DESC, mst DESC) as rn
  FROM law_version
)
WHERE rn = 1;
`;

  let latestOut;
  try {
    latestOut = runSQL(latestSQL);
  } catch {
    console.error("❌ 최신 mst 조회 실패");
    return;
  }

  const protectedMst = extractMstList(latestOut);
  console.log("🔒 보호 mst:", protectedMst.length);

  // 🔴 2. 삭제 대상 조회 (최신 제외 + 오래된 것만)
  const findSQL = `
SELECT mst FROM law_version
WHERE 시행일 IS NOT NULL
AND 시행일 < '${cutoff}'
AND mst NOT IN (${protectedMst.map(x => `'${x}'`).join(",") || "''"});
`;

  let out;
  try {
    out = runSQL(findSQL);
  } catch {
    console.error("❌ 삭제 대상 조회 실패");
    return;
  }

  const mstList = extractMstList(out);

  if (mstList.length === 0) {
    console.log("✔ 삭제 대상 없음");
    return;
  }

  console.log("🗑 삭제 대상:", mstList.length, "개");

  for (const mst of mstList) {
    console.log("→ 삭제:", mst);

    const delSQL = `
DELETE FROM law_article WHERE mst='${mst}';
DELETE FROM law_version WHERE mst='${mst}';
`;

    try {
      runSQL(delSQL);
    } catch {
      console.error("❌ 삭제 실패:", mst);
    }
  }

  console.log("🎯 버전 정리 완료");
}

run();
