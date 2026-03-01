// src/crawler/parkingParser.js (FULL REPLACE)
//
// ✅ 목적
// - parking_ordinance_text의 body_text / tables_text(별표)에서
//   "주차 설치기준"을 기계가 계산 가능한 규칙(parking_rules) 형태로 추출
//
// ✅ 현재 단계(실전 최소 기능)
// - 1) "㎡당 1대" / "㎡마다 1대" / "㎡당 1주차" 류 패턴을 추출 → unit=m2_per_space
// - 2) "연면적 ○○㎡당 1대" 등도 동일 취급(분모=㎡)
// - 3) 용도명(use_label) 추출은 '행 라벨' 기반으로 최대한 보수적으로 시도
// - 4) 못 뽑으면 빈 배열 반환(크롤러/서버가 NO_RULES_YET로 처리)
//
// ⚠️ 다음 단계(정확도 강화)
// - 표 구조(행/열) 정확 파싱, "세대당/호당/객실당" 등 unit 확장
// - '부설주차장 설치기준' 별표/부칙/조문 위치 메타 추출

function norm(s) {
    return String(s ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }
  
  function squeeze(s) {
    return String(s ?? "").replace(/\s+/g, "");
  }
  
  function uniqBy(arr, keyFn) {
    const m = new Map();
    for (const x of arr) {
      const k = keyFn(x);
      if (!k) continue;
      if (!m.has(k)) m.set(k, x);
    }
    return Array.from(m.values());
  }
  
  /**
   * 텍스트를 줄 단위로 분리
   */
  function splitLines(text) {
    const t = norm(text);
    if (!t) return [];
    return t
      .split(/\r?\n+/)
      .map((x) => norm(x))
      .filter(Boolean);
  }
  
  /**
   * "150㎡당 1대" 류 패턴에서 분모(㎡) 추출
   * - 반환: number|null
   */
  function parseM2Denom(line) {
    const s = norm(line);
  
    // 예시:
    // "연면적 150제곱미터당 1대"
    // "150㎡당 1대"
    // "150 m2 당 1대"
    // "150제곱미터마다 1대"
    const reList = [
      /([0-9]{1,6}(?:\.[0-9]+)?)\s*(?:㎡|m2|m²|제곱미터|제곱\s*미터)\s*(?:당|마다)\s*(?:1\s*)?(?:대|면|주차)/i,
      /(?:연면적|바닥면적)\s*([0-9]{1,6}(?:\.[0-9]+)?)\s*(?:㎡|m2|m²|제곱미터|제곱\s*미터)\s*(?:당|마다)/i,
    ];
  
    for (const re of reList) {
      const m = s.match(re);
      if (m && m[1]) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    return null;
  }
  
  /**
   * 라인에서 "용도 라벨"을 최대한 보수적으로 추출
   * - 표/별표에서 흔한 형태:
   *   "업무시설 150㎡당 1대"
   *   "근린생활시설(제1종) 200㎡당 1대"
   * - 너무 공격적으로 추출하면 오염되므로:
   *   숫자/㎡ 패턴 앞쪽 텍스트만 잘라서 use_label로 사용
   */
  function extractUseLabel(line) {
    const s = norm(line);
    if (!s) return "";
  
    // 숫자/㎡ 시작 위치를 찾고 그 앞부분만 label 후보로
    const idx = s.search(/[0-9]{1,6}\s*(?:㎡|m2|m²|제곱미터|제곱\s*미터)/i);
    if (idx <= 0) return "";
  
    const head = norm(s.slice(0, idx));
  
    // 너무 짧거나 의미없는 경우 제외
    if (head.length < 2) return "";
    if (/(?:주차|설치|기준|비고|면적|대수)$/i.test(head)) return "";
  
    // 끝에 :, - 같은 구분자 제거
    return norm(head.replace(/[:\-–—]+$/g, ""));
  }
  
  /**
   * 본문/별표 텍스트에서 규칙 추출
   * @param {object} args
   * @param {string} args.jur_key
   * @param {string} args.ordin_id
   * @param {string} args.text  body_text + tables_text 등
   * @returns {Array<{jur_key, ordin_id, use_label, unit, value_num, note, source}>}
   */
  export function parseParkingRulesFromText({ jur_key, ordin_id, text }) {
    const lines = splitLines(text);
    if (!lines.length) return [];
  
    const rules = [];
  
    for (const line of lines) {
      const denom = parseM2Denom(line);
      if (!denom) continue;
  
      const use_label = extractUseLabel(line) || "기타";
  
      rules.push({
        jur_key: jur_key || null,
        ordin_id: ordin_id || null,
        use_label,
        unit: "m2_per_space",
        value_num: denom,
        note: null,
        source: `LINE:${line.slice(0, 160)}`,
      });
    }
  
    // 중복 제거: (use_label + unit + value_num)
    return uniqBy(rules, (r) => `${squeeze(r.use_label)}|${r.unit}|${r.value_num}`);
  }
  
  /**
   * ordinance_text 레코드(=DB에서 꺼낸 것) 하나를 받아 규칙 배열로 반환
   * @param {object} row
   * @returns rules[]
   */
  export function parseParkingRulesFromOrdinanceTextRow(row) {
    const jur_key = row?.jur_key || null;
    const ordin_id = row?.ordin_id || row?.ordinId || null;
  
    const body = row?.body_text || "";
    const tables = row?.tables_text || "";
  
    // tables_text 우선(별표가 핵심인 경우가 많음)
    const merged = [tables, body].filter(Boolean).join("\n");
  
    return parseParkingRulesFromText({ jur_key, ordin_id, text: merged });
  }
  
  export default {
    parseParkingRulesFromText,
    parseParkingRulesFromOrdinanceTextRow,
  };