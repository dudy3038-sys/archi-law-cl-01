// public/script.js (NEW FILE)
// 목적: "수원시 기준" 주차 자동계산(초기 버전)
// - 기존 index.html 인라인 스크립트와 충돌 방지 (전역 함수/변수 최소화)
// - STEP UI 요소(parkUse, parkBasisArea, parkCalcBtn, parkResetBtn, parkUseFaTotalBtn)
// - 결과를 parkLegal(법정), parkMemo(메모), parkResultBox(상세)에 반영
//
// ⚠️ 주의:
// - 이 버전은 "수원시 조례 기준"을 완전 데이터화하기 전, 실무용 SaaS를 향한 1차 베이스.
// - 다음 단계에서: 조례 표(용도별 산정식/기준단위/예외/완화/장애인/전기차 등)를 DB로 넣고,
//   이 파일은 "표 기반 엔진"으로 교체한다.

(() => {
    const $ = (id) => document.getElementById(id);
  
    // ---------- 공통 유틸 ----------
    function n(v) {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    }
    function ceilToInt(x) {
      // 실무에선 대체로 올림(소수점 자리 발생 시)
      return Math.ceil(n(x));
    }
    function fmtNum(x) {
      const v = n(x);
      return v.toLocaleString("ko-KR");
    }
  
    // ---------- “수원시 조례 기준” 임시 규칙(초기) ----------
    // 여기 값들은 너가 가진 수원시 조례표를 확인해서 반드시 교체해야 함.
    // 지금은 "엔진/흐름"을 고정시키는 게 목표라, 대표적인 형태(면적당 1대)를 우선 제공.
    //
    // shape:
    //  - key: parkUse 값
    //  - basis: "area" | "unit" (현재는 area만 사용)
    //  - per: 1대당 기준면적(㎡)  -> 법정대수 = ceil(연면적 / per)
    //  - note: 메모/근거 표시(임시)
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
  
    // ---------- 핵심 계산 ----------
    function calcSuwonParking({ useKey, area }) {
      const rule = SUWON_PARKING_RULES[useKey];
      if (!rule) {
        return {
          ok: false,
          error: "UNKNOWN_USE",
          legal: 0,
          memo: "용도를 선택하세요.",
          detail: "STEP 2에서 용도 선택이 필요합니다.",
        };
      }
  
      const a = n(area);
      if (a <= 0) {
        return {
          ok: false,
          error: "INVALID_AREA",
          legal: 0,
          memo: "면적을 입력하세요.",
          detail: "STEP 3에서 연면적(㎡)을 0보다 크게 입력해야 합니다.",
        };
      }
  
      // area 기반
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
        `- 용도: ${useKey}`,
        `- 입력 연면적: ${fmtNum(a)} ㎡`,
        `- 기준: 1대 / ${fmtNum(per)} ㎡`,
        `- 계산: ${fmtNum(a)} ÷ ${fmtNum(per)} = ${raw.toFixed(4)}`,
        `- 올림 → 법정: ${fmtNum(legal)} 대`,
        "",
        "※ 현재 값은 임시(엔진 검증용)입니다.",
        "   다음 단계에서 '수원시 주차 조례표'를 DB로 넣고, 이 계산을 표 기반으로 완성합니다.",
      ].join("\n");
  
      const memo = `${rule.note} | 계산: ceil(연면적 ${fmtNum(a)}㎡ ÷ ${fmtNum(per)}㎡/대) = ${fmtNum(
        legal
      )}대`;
  
      return { ok: true, legal, memo, detail };
    }
  
    // ---------- UI 반영 ----------
    function setText(id, text) {
      const el = $(id);
      if (el) el.textContent = text ?? "";
    }
    function setValue(id, value) {
      const el = $(id);
      if (el) el.value = value;
    }
  
    function bindParkingUI() {
      const city = $("parkCity");
      const useSel = $("parkUse");
      const basisArea = $("parkBasisArea");
  
      const btnUseFaTotal = $("parkUseFaTotalBtn");
      const btnCalc = $("parkCalcBtn");
      const btnReset = $("parkResetBtn");
  
      const outLegal = $("parkLegal");
      const outMemo = $("parkMemo");
      const outBox = $("parkResultBox");
  
      // 이 페이지에 STEP UI가 없으면 그냥 종료
      if (!useSel || !basisArea || !btnCalc || !outLegal || !outMemo || !outBox) return;
  
      // city는 현재 고정
      if (city) city.value = "경기도 수원시";
  
      // 연면적(계) 자동연동
      if (btnUseFaTotal) {
        btnUseFaTotal.addEventListener("click", () => {
          const faTotal = n($("faTotal")?.value);
          basisArea.value = String(faTotal);
          setText("parkResultBox", `연면적(계) ${fmtNum(faTotal)}㎡ 를 주차 기준면적으로 가져왔습니다.`);
        });
      }
  
      // 계산 실행
      btnCalc.addEventListener("click", () => {
        const useKey = String(useSel.value || "");
        const area = n(basisArea.value);
  
        const r = calcSuwonParking({ useKey, area });
  
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
  
      // 초기화
      if (btnReset) {
        btnReset.addEventListener("click", () => {
          useSel.value = "";
          basisArea.value = "0";
          outLegal.value = "0";
          outMemo.value = "";
          outBox.textContent = "대기중…";
        });
      }
  
      // UX: 용도/면적 바꾸면 결과 박스만 안내(자동계산은 버튼으로)
      useSel.addEventListener("change", () => {
        setText("parkResultBox", "용도가 변경되었습니다. '주차대수 자동계산'을 눌러 반영하세요.");
      });
      basisArea.addEventListener("input", () => {
        setText("parkResultBox", "면적이 변경되었습니다. '주차대수 자동계산'을 눌러 반영하세요.");
      });
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