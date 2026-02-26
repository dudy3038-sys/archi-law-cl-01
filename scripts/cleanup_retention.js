import { execSync } from "child_process";

const DB = "archi_law_db";
const KEEP_YEARS = 3;

// 기준일 계산 (3년 전)
function getCutoff() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - KEEP_YEARS);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function run() {
  const cutoff = getCutoff();

  console.log("🧹 법령 버전 정리 시작");
  console.log("보관:", KEEP_YEARS, "년");
  console.log("삭제 기준 시행일 <", cutoff);

  // 1️⃣ 삭제 대상 MST 찾기
  const findSQL = `
SELECT mst FROM law_version
WHERE 시행일 < '${cutoff}';
`;

  let out;
  try {
    out = execSync(
      `npx wrangler d1 execute ${DB} --remote --command="${findSQL}"`,
      { encoding: "utf-8" }
    );
  } catch (e) {
    console.error("❌ mst 조회 실패");
    return;
  }

  const mstList = [...out.matchAll(/"mst"\s*:\s*"([^"]+)"/g)].map(m => m[1]);

  if (mstList.length === 0) {
    console.log("✔ 삭제 대상 없음");
    return;
  }

  console.log("삭제 대상 mst:", mstList.length, "개");

  for (const mst of mstList) {
    console.log("→ 삭제:", mst);

    const delArticle = `
DELETE FROM law_article WHERE mst='${mst}';
`;

    const delVersion = `
DELETE FROM law_version WHERE mst='${mst}';
`;

    try {
      execSync(
        `npx wrangler d1 execute ${DB} --remote --command="${delArticle}"`,
        { stdio: "inherit" }
      );

      execSync(
        `npx wrangler d1 execute ${DB} --remote --command="${delVersion}"`,
        { stdio: "inherit" }
      );
    } catch (e) {
      console.error("❌ 삭제 실패 mst:", mst);
    }
  }

  console.log("🎯 버전 정리 완료");
}

run();