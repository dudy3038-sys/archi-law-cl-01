// public/script.js (FULL REPLACE)
// 목적(새 UI 기준):
// 1) 지자체(시/도, 시/군/구, 행정동, 법정동) 입력값을 "주차 자동계산"과 연동
// 2) "수원시 기준" 주차 자동계산(초기 버전)
//    - 현재는 수원시만 계산 지원, 그 외 지역은 "지원 준비중" 안내로 오류 최소화
//
// ⚠️ 주의:
// - 지자체 자동표시는 현재 index.html에서 "시/도/시군구는 선택, 동은 수동" 구조임.
// - 다음 단계에서: 지자체별 조례표 DB + 표 기반 엔진으로 교체 권장.

(() => {
    const $ = (id) => document.getElementById(id);
  
    // ---------- 유틸 ----------
    function n(v) {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    }
    function ceilToInt(x) {
      return Math.ceil(n(x));
    }
    function fmtNum(x) {
      const v = n(x);
      return v.toLocaleString("ko-KR");
    }
    function setText(id, text) {
      const el = $(id);
      if (el) el.textContent = text ?? "";
    }
    function setValue(id, value) {
      const el = $(id);
      if (el) el.value = value ?? "";
    }
  
    // =========================================================
    // 1) 지자체 값 가져오기(새 UI)
    // =========================================================
    function getJurisText() {
      const sido = String($("jSido")?.value || "").trim();
      const sigungu = String($("jSigungu")?.value || "").trim();
      const adminDong = String($("jAdminDong")?.value || "").trim();
      const legalDong = String($("jLegalDong")?.value || "").trim();
  
      // 주차 판정용은 시군구 우선(없으면 시도)
      const cityText = (sigungu || sido).trim();
  
      return { sido, sigungu, adminDong, legalDong, cityText };
    }
  
    function isSuwonCityText(cityText) {
      const t = String(cityText || "").replace(/\s+/g, " ").trim();
      if (!t) return false;
      // "경기도 수원시", "수원시 팔달구" 등 폭넓게 허용
      return t.includes("수원시");
    }
  
    // =========================================================
    // 2) 주용도 -> 주차 룰 키 매핑(새 UI)
    // =========================================================
    function mapPrimaryUseToRuleKey(primaryUseLabel) {
      const u = String(primaryUseLabel || "").trim();
  
      // ✅ 1차: 최소한 실무 흐름용 매핑
      // 다음 단계에서: 용도 체계(건축물용도 코드)로 표준화 권장
      const map = {
        "업무시설": "office",
        "근린생활시설": "neighborhood",
        "공동주택": "housing",
        "판매/영업시설": "retail",
        "사회복지시설": "welfare",
        "기타": "etc",
        // 아래는 임시로 etc 처리(추후 조례표 기준으로 세분화)
        "문화/집회시설": "etc",
        "교육연구시설": "etc",
      };
  
      return map[u] || "";
    }
  
    // =========================================================
    // 3) 수원시 주차 계산(초기 엔진)
    // =========================================================
    // ⚠️ 반드시 수원시 조례표로 교체 필요(현재는 엔진 검증용 임시값)
    const SUWON_PARKING_RULES = {
      office: {
        basis: "area",
        per: 200,
        note: "수원시 조례(임시) · 업무시설: 1대/200㎡ (확정 필요)",
      },
      neighborhood: {
        basis: "area",
        per: 150,
        note: "수원시 조례(임시) · 근린생활시설: 1대/150㎡ (확정 필요)",
      },
      housing: {
        basis: "area",
        per: 80,
        note: "수원시 조례(임시) · 공동주택: 1대/80㎡ (확정 필요, 세대수 기준 가능)",
      },
      welfare: {
        basis: "area",
        per: 250,
        note: "수원시 조례(임시) · 사회복지시설: 1대/250㎡ (확정 필요)",
      },
      retail: {
        basis: "area",
        per: 120,
        note: "수원시 조례(임시) · 판매/영업시설: 1대/120㎡ (확정 필요)",
      },
      etc: {
        basis: "area",
        per: 200,
        note: "수원시 조례(임시) · 기타: 1대/200㎡ (확정 필요)",
      },
    };
  
    function calcSuwonParking({ ruleKey, area, primaryUseLabel }) {
      const rule = SUWON_PARKING_RULES[ruleKey];
      if (!rule) {
        return {
          ok: false,
          error: "UNKNOWN_USE",
          legal: 0,
          memo: "주용도를 선택하세요.",
          detail: "용도 > 주용도 선택이 필요합니다.",
        };
      }
  
      const a = n(area);
      if (a <= 0) {
        return {
          ok: false,
          error: "INVALID_AREA",
          legal: 0,
          memo: "연면적(계)을 확인하세요.",
          detail: "연면적(계)이 0보다 크게 계산/입력되어야 합니다. (층별면적개요 면적을 입력하세요)",
        };
      }
  
      const per = n(rule.per);
      if (per <= 0) {
        return {
          ok: false,
          error: "RULE_NOT_READY",
          legal: 0,
          memo: "조례 기준(표) 데이터가 준비되지 않았습니다.",
          detail: "관리자: SUWON_PARKING_RULES 값을 확정/교체하세요.",
        };
      }
  
      const raw = a / per;
      const legal = ceilToInt(raw);
  
      const detail = [
        "[수원시] 주차대수(법정) 산정",
        `- 주용도: ${primaryUseLabel || "(미선택)"} (${ruleKey})`,
        `- 입력 연면적(계): ${fmtNum(a)} ㎡`,
        `- 기준: 1대 / ${fmtNum(per)} ㎡`,
        `- 계산: ${fmtNum(a)} ÷ ${fmtNum(per)} = ${raw.toFixed(4)}`,
        `- 올림 → 법정: ${fmtNum(legal)} 대`,
        "",
        "※ 현재 기준값은 임시(엔진 검증용)입니다.",
        "   다음 단계에서 '수원시 주차 조례표'를 DB로 넣고, 계산을 표 기반으로 완성합니다.",
      ].join("\n");
  
      const memo =
        `${rule.note} | 계산: ceil(연면적 ${fmtNum(a)}㎡ ÷ ${fmtNum(per)}㎡/대) = ${fmtNum(legal)}대`;
  
      return { ok: true, legal, memo, detail };
    }
  
    // =========================================================
    // 4) UI 바인딩(새 UI)
    // =========================================================
    function bindParkingUI() {
      const btnCalc = $("parkCalcBtn");
      const btnReset = $("parkResetBtn");
  
      const outLegal = $("parkLegal");
      const outMemo = $("parkMemo");
      const outBox = $("parkResultBox");
  
      const primaryUse = $("primaryUse");
      const faTotal = $("faTotal");
  
      // 새 UI 필수 요소 확인
      if (!btnCalc || !outLegal || !outMemo || !outBox || !primaryUse || !faTotal) return;
  
      function explainNotReady(cityText) {
        outLegal.value = "0";
        outMemo.value = "현재는 '수원시'만 주차 자동계산을 지원합니다.";
        outBox.textContent = [
          "[주차 자동계산] 지원 준비중",
          `- 현재 지자체(시/군/구): ${cityText || "(미확정)"}`,
          "",
          "✅ 해결:",
          "1) 시/도, 시/군/구 선택에서 '수원시 ○○구'를 선택",
          "2) (다음 단계) 지자체별 조례 DB를 넣어 자동확장",
        ].join("\n");
      }
  
      btnCalc.addEventListener("click", () => {
        const { cityText } = getJurisText();
        const primaryUseLabel = String(primaryUse.value || "").trim();
        const ruleKey = mapPrimaryUseToRuleKey(primaryUseLabel);
        const area = n(faTotal.value);
  
        // ✅ 오류 최소화: 수원시만 계산 지원
        if (!isSuwonCityText(cityText)) {
          explainNotReady(cityText);
          return;
        }
  
        const r = calcSuwonParking({ ruleKey, area, primaryUseLabel });
  
        if (!r.ok) {
          outLegal.value = "0";
          outMemo.value = r.memo || "계산 실패";
          outBox.textContent = r.detail || "계산에 실패했습니다.";
          return;
        }
  
        outLegal.value = String(r.legal);
        outMemo.value = r.memo || "";
        outBox.textContent = r.detail || "";
      });
  
      if (btnReset) {
        btnReset.addEventListener("click", () => {
          outLegal.value = "0";
          outMemo.value = "";
          outBox.textContent = "대기중…";
        });
      }
  
      // UX 안내
      const hint = () => setText("parkResultBox", "값이 변경되었습니다. '주차대수 자동계산'을 눌러 반영하세요.");
  
      // 지자체 관련 변경 시
      ["jSido", "jSigungu", "jAdminDong", "jLegalDong"].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener("change", hint);
        if (el) el.addEventListener("input", hint);
      });
  
      // 주용도 변경 시
      primaryUse.addEventListener("change", hint);
  
      // 연면적(계) 변경 시(층별면적 입력으로 자동 갱신됨)
      faTotal.addEventListener("input", hint);
    }
  
    // ---------- 부팅 ----------
    function boot() {
      bindParkingUI();
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  })();