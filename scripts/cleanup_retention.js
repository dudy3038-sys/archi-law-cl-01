import { execSync } from "child_process";

// 보관 정책
const KEEP_YEARS = 3;   // 최신 3년 보관
const DB_NAME = "archi_law_db";

// 삭제 기준 계산
function getCutoffDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - KEEP_YEARS);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const cutoff = getCutoffDate();

  console.log("🧹 법령 DB 정리 시작");
  console.log("기준일:", cutoff);

  // 오래된 버전 삭제
  const sql = `
DELETE FROM law_article
WHERE updated_at < '${cutoff}';
`;

  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --command="${sql}"`,
      { stdio: "inherit" }
    );

    console.log("🎯 오래된 조문 삭제 완료");
  } catch (e) {
    console.error("❌ cleanup 실패:", e.message);
  }
}

run();