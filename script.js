// public/script.js (FULL REPLACE)
// 목적:
// 1) "지자체(시/군/구/법정동/행정동) 자동표시" 자동 채움 + 직접수정 토글
// 2) parkCity(주차 STEP 1) 를 지자체 자동표시와 연동
// 3) "수원시 기준" 주차 자동계산(초기 버전)
//    - 현재는 수원시만 계산 지원, 그 외 지역은 "지원 준비중" 안내로 오류 최소화
//
// ⚠️ 주의:
// - 지자체 자동표시는 1차: "주소 문자열 파싱(클라)" 기반
// - 다음 단계에서: 서버(/api/reverse or 행정구역 API)로 "표준 행정구역 코드 기반" 확정치로 교체 권장
// - 주차 산정 규칙은 임시(엔진 검증용). 반드시 수원시 조례표로 교체해야 함.

(() => {
    const $ = (id) => document.getElementById(id);
  
    // ---------- 공통 유틸 ----------
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
    function setReadonly(id, isReadonly) {
      const el = $(id);
      if (!el) return;
      if (isReadonly) {
        el.setAttribute("readonly", "readonly");
        el.classList.add("readonly");
      } else {
        el.removeAttribute("readonly");
        el.classList.remove("readonly");
      }
    }
  
    // =========================================================
    // 1) 지자체 자동표시(클라 1차 파싱)
    // =========================================================
    // 기대 형태 예:
    // - "경기도 수원시 팔달구 인계동 ..."
    // - "서울특별시 강남구 역삼동 ..."
    // - "부산광역시 해운대구 우동 ..."
    //
    // ✅ 목표: “오류 최소화”
    // - 완벽한 행정동/법정동 분리는 DB/코드 기반이 필요함(다음 단계)
    // - 지금은 "행정동/법정동 동일 값으로 임시 채움" + 수동 수정 토글 제공
    function parseJurisFromAddr(addrRaw) {
      const addr = String(addrRaw || "").trim();
      if (!addr) return null;
  
      // 시·도 후보(1차)
      const SIDO_LIST = [
        "서울특별시",
        "부산광역시",
        "대구광역시",
        "인천광역시",
        "광주광역시",
        "대전광역시",
        "울산광역시",
        "세종특별자치시",
        "경기도",
        "강원특별자치도",
        "충청북도",
        "충청남도",
        "전북특별자치도",
        "전라남도",
        "경상북도",
        "경상남도",
        "제주특별자치도",
      ];
  
      let sido = "";
      for (const s of SIDO_LIST) {
        if (addr.startsWith(s)) {
          sido = s;
          break;
        }
      }
  
      // 시도 없으면, “서울/부산/경기” 같은 약칭이 앞에 오는 케이스 최소 대응
      // (정확도 낮아서 강제하지 않고 힌트 수준으로만)
      if (!sido) {
        const shortMap = {
          서울: "서울특별시",
          부산: "부산광역시",
          대구: "대구광역시",
          인천: "인천광역시",
          광주: "광주광역시",
          대전: "대전광역시",
          울산: "울산광역시",
          세종: "세종특별자치시",
          경기: "경기도",
          강원: "강원특별자치도",
          충북: "충청북도",
          충남: "충청남도",
          전북: "전북특별자치도",
          전남: "전라남도",
          경북: "경상북도",
          경남: "경상남도",
          제주: "제주특별자치도",
        };
        const first = addr.split(/\s+/)[0] || "";
        if (shortMap[first]) sido = shortMap[first];
      }
  
      // 토큰 분해
      const tokens = addr.split(/\s+/).filter(Boolean);
  
      // 시·군·구: "OO시", "OO군", "OO구" 토큰을 최대 2개까지 결합(예: 수원시 팔달구)
      const sggTokens = [];
      for (const t of tokens) {
        if (/(시|군|구)$/.test(t)) {
          // 시도 토큰(서울특별시 등)은 제외
          if (t === sido) continue;
          sggTokens.push(t);
          if (sggTokens.length >= 2) break;
        }
      }
      const sigungu = sggTokens.join(" ").trim();
  
      // 동/읍/면/리: 뒤쪽에서 첫 발견을 사용
      let dong = "";
      for (const t of tokens) {
        if (/(동|읍|면|리)$/.test(t)) {
          // 괄호나 번지류 제외 간단 처리
          dong = t.replace(/[(),]/g, "");
          break;
        }
      }
  
      // 임시: 행정동/법정동 동일 채움(다음 단계에서 DB로 분리)
      const adminDong = dong;
      const legalDong = dong;
  
      // 최소라도 하나는 있어야 의미 있음
      if (!sido && !sigungu && !dong) return null;
  
      return { sido, sigungu, adminDong, legalDong };
    }
  
    function applyJurisToUI(j) {
      // 읽기전용 칸 채우기
      setValue("jurisSido", j?.sido || "");
      setValue("jurisSigungu", j?.sigungu || "");
      setValue("jurisAdminDong", j?.adminDong || "");
      setValue("jurisLegalDong", j?.legalDong || "");
  
      // 주차 STEP 1(parkCity) 연동: 시·군·구 우선, 없으면 시·도
      const cityText = (j?.sigungu || j?.sido || "").trim();
      if ($("parkCity")) {
        $("parkCity").value = cityText ? cityText : "(자동 표시 대기중)";
      }
    }
  
    function syncJurisReadonlyByOverride() {
      const override = $("jurisOverride")?.checked || false;
      // override 체크하면 직접 수정 가능(=readonly 해제)
      setReadonly("jurisSido", !override);
      setReadonly("jurisSigungu", !override);
      setReadonly("jurisAdminDong", !override);
      setReadonly("jurisLegalDong", !override);
    }
  
    function bindJurisUI() {
      const addrEl = $("siteAddr");
      const overrideEl = $("jurisOverride");
  
      // 해당 UI 없으면 종료
      if (!addrEl || !overrideEl) return;
  
      // 초기 readonly 상태 적용
      syncJurisReadonlyByOverride();
  
      // override 토글
      overrideEl.addEventListener("change", () => {
        syncJurisReadonlyByOverride();
  
        // 수동모드 ON이면 안내, OFF면 주소로 재파싱
        if (overrideEl.checked) {
          setText(
            "parkResultBox",
            "지자체 직접 수정 모드입니다. 값 수정 후 '주차대수 자동계산'을 눌러 반영하세요."
          );
        } else {
          const parsed = parseJurisFromAddr(addrEl.value);
          if (parsed) applyJurisToUI(parsed);
        }
      });
  
      // 주소 입력시 자동 파싱(디바운스)
      let t = null;
      addrEl.addEventListener("input", () => {
        if (overrideEl.checked) return; // 직접 수정 모드일 때는 자동 덮어쓰기 금지
        clearTimeout(t);
        t = setTimeout(() => {
          const parsed = parseJurisFromAddr(addrEl.value);
          if (parsed) applyJurisToUI(parsed);
          else applyJurisToUI({ sido: "", sigungu: "", adminDong: "", legalDong: "" });
        }, 250);
      });
  
      // 시작 시 한 번 반영(기본값/브라우저 자동완성 대응)
      const initParsed = parseJurisFromAddr(addrEl.value);
      if (initParsed) applyJurisToUI(initParsed);
      else applyJurisToUI({ sido: "", sigungu: "", adminDong: "", legalDong: "" });
  
      // 수동 수정 값이 parkCity에 반영되도록: 지자체 칸 변경 시에도 parkCity 업데이트
      const ids = ["jurisSido", "jurisSigungu", "jurisAdminDong", "jurisLegalDong"];
      ids.forEach((id) => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("input", () => {
          const cityText = (String($("jurisSigungu")?.value || "") || "").trim() || (String($("jurisSido")?.value || "") || "").trim();
          if ($("parkCity")) $("parkCity").value = cityText ? cityText : "(자동 표시 대기중)";
        });
      });
    }
  
    // =========================================================
    // 2) 수원시 주차 계산(초기 엔진)
    // =========================================================
    // 여기 값들은 수원시 조례표 확인 후 반드시 교체해야 함.
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
  
    function isSuwonCityText(cityText) {
      const t = String(cityText || "").replace(/\s+/g, " ").trim();
      if (!t) return false;
      // "경기도 수원시", "수원시 팔달구" 등 폭넓게 허용
      return t.includes("수원시");
    }
  
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
        "   다음 단계에서 '수원시 주차 조례표'를 DB로 넣고, 계산을 표 기반으로 완성합니다.",
      ].join("\n");
  
      const memo = `${rule.note} | 계산: ceil(연면적 ${fmtNum(a)}㎡ ÷ ${fmtNum(per)}㎡/대) = ${fmtNum(legal)}대`;
  
      return { ok: true, legal, memo, detail };
    }
  
    function bindParkingUI() {
      const cityEl = $("parkCity");
      const useSel = $("parkUse");
      const basisArea = $("parkBasisArea");
  
      const btnUseFaTotal = $("parkUseFaTotalBtn");
      const btnCalc = $("parkCalcBtn");
      const btnReset = $("parkResetBtn");
  
      const outLegal = $("parkLegal");
      const outMemo = $("parkMemo");
      const outBox = $("parkResultBox");
  
      // 이 페이지에 STEP UI가 없으면 종료
      if (!useSel || !basisArea || !btnCalc || !outLegal || !outMemo || !outBox) return;
  
      // 시작 시 parkCity가 비어있으면(지자체 자동표시 미동작 환경 대비) 기본 표시
      if (cityEl && !String(cityEl.value || "").trim()) cityEl.value = "(자동 표시 대기중)";
  
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
        const cityText = String(cityEl?.value || "");
        const useKey = String(useSel.value || "");
        const area = n(basisArea.value);
  
        // ✅ 오류 최소화: 수원시만 계산 지원
        if (!isSuwonCityText(cityText)) {
          outLegal.value = "0";
          outMemo.value = "현재는 '수원시'만 주차 자동계산을 지원합니다.";
          outBox.textContent = [
            "[주차 자동계산] 지원 준비중",
            `- 현재 지자체: ${cityText || "(미확정)"}`,
            "",
            "✅ 해결:",
            "1) 대지위치(주소)를 정확히 입력해 '지자체 자동표시'가 수원시로 잡히는지 확인",
            "2) 자동표시가 틀리면 '직접 수정'을 켜서 시·군·구에 '수원시'를 포함하도록 수정",
            "",
            "※ 다음 단계에서: 지자체별(조례) DB를 넣고, 선택/자동매칭으로 확장합니다.",
          ].join("\n");
          return;
        }
  
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
      bindJurisUI();
      bindParkingUI();
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  })();