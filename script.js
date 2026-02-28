// public/script.js (FULL REPLACE)
// 목적(이번 턴 범위):
// 1) index.html 길이/복잡도 감소: 주요 UI 동작을 여기로 이동
// 2) 대지위치: 큰 프레임 제거(이미 index에서 제거 완료)
// 3) 지자체: 시도/시군구 = 선택형(전국), 행정동/법정동/상세주소 = 수동 입력
//    + "직접 수정" 토글(자동 파싱 덮어쓰기 방지)
// 4) 용도: 별표1 '주용도' 카테고리만 선택 가능 + 추가/삭제 + 최소 1개 유지 + 주용도 지정
// 5) 연면적: 용도별면적개요(행 추가/삭제/합계), 층별면적개요(층추가/정렬/합계)
// 6) 층별 합계가 연면적(지상/지하/계)와 자동 연동되며, 하단 합계행은 제거(이미 index에서 제거)
//
// 주차대수(자동계산)는 "다음 단계"에서 다시 보기로 했으므로
// - 이번 파일에선 parkResultBox 안내만 유지 (UI 없으면 스킵)

(() => {
    const $ = (id) => document.getElementById(id);
  
    // ---------- 숫자 유틸 ----------
    function n(v) {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    }
    function round2(x) {
      const v = n(x);
      return Math.round(v * 100) / 100;
    }
    function format2(x) {
      return round2(x).toFixed(2);
    }
    function set2(id, value) {
      const el = $(id);
      if (!el) return;
      el.value = format2(value);
    }
    function setText(id, text) {
      const el = $(id);
      if (!el) return;
      el.textContent = text ?? "";
    }
  
    // =========================================================
    // A) 시도/시군구 선택 데이터 (전국)
    // - 정확한 "행정동/법정동" 코드는 다음 단계에서 API/코드로 확정 권장
    // =========================================================
    const SIDO = [
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
  
    // ✅ 시군구 목록(대표/실무용: 누락 최소화 버전)
    // 필요하면 나중에 “공식 코드 API”로 완전 자동화 가능.
    const SIGUNGU = {
      "서울특별시": ["종로구","중구","용산구","성동구","광진구","동대문구","중랑구","성북구","강북구","도봉구","노원구","은평구","서대문구","마포구","양천구","강서구","구로구","금천구","영등포구","동작구","관악구","서초구","강남구","송파구","강동구"],
      "부산광역시": ["중구","서구","동구","영도구","부산진구","동래구","남구","북구","해운대구","사하구","금정구","강서구","연제구","수영구","사상구","기장군"],
      "대구광역시": ["중구","동구","서구","남구","북구","수성구","달서구","달성군","군위군"],
      "인천광역시": ["중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구","강화군","옹진군"],
      "광주광역시": ["동구","서구","남구","북구","광산구"],
      "대전광역시": ["동구","중구","서구","유성구","대덕구"],
      "울산광역시": ["중구","남구","동구","북구","울주군"],
      "세종특별자치시": ["세종시"],
      "경기도": [
        "수원시","성남시","용인시","고양시","화성시","부천시","남양주시","안산시","안양시","평택시","시흥시","김포시","파주시","의정부시","광주시","하남시","광명시","군포시","오산시","양주시",
        "이천시","안성시","구리시","포천시","의왕시","여주시","동두천시","과천시","가평군","양평군","연천군"
      ],
      "강원특별자치도": ["춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시","홍천군","횡성군","영월군","평창군","정선군","철원군","화천군","양구군","인제군","고성군","양양군"],
      "충청북도": ["청주시","충주시","제천시","보은군","옥천군","영동군","증평군","진천군","괴산군","음성군","단양군"],
      "충청남도": ["천안시","공주시","보령시","아산시","서산시","논산시","계룡시","당진시","금산군","부여군","서천군","청양군","홍성군","예산군","태안군"],
      "전북특별자치도": ["전주시","군산시","익산시","정읍시","남원시","김제시","완주군","진안군","무주군","장수군","임실군","순창군","고창군","부안군"],
      "전라남도": ["목포시","여수시","순천시","나주시","광양시","담양군","곡성군","구례군","고흥군","보성군","화순군","장흥군","강진군","해남군","영암군","무안군","함평군","영광군","장성군","완도군","진도군","신안군"],
      "경상북도": ["포항시","경주시","김천시","안동시","구미시","영주시","영천시","상주시","문경시","경산시","의성군","청송군","영양군","영덕군","청도군","고령군","성주군","칠곡군","예천군","봉화군","울진군","울릉군"],
      "경상남도": ["창원시","진주시","통영시","사천시","김해시","밀양시","거제시","양산시","의령군","함안군","창녕군","고성군","남해군","하동군","산청군","함양군","거창군","합천군"],
      "제주특별자치도": ["제주시","서귀포시"],
    };
  
    // =========================================================
    // B) 주용도(별표1) “대분류” (PDF 기반 29개)
    // - 상세 소분류는 제외(요청사항)
    // =========================================================
    const MAIN_USES = [
      "단독주택",
      "공동주택",
      "제1종 근린생활시설",
      "제2종 근린생활시설",
      "문화 및 집회시설",
      "종교시설",
      "판매시설",
      "운수시설",
      "의료시설",
      "교육연구시설",
      "노유자시설",
      "수련시설",
      "운동시설",
      "업무시설",
      "숙박시설",
      "위락시설",
      "공장",
      "창고시설",
      "위험물 저장 및 처리 시설",
      "자동차 관련 시설",
      "동물 및 식물 관련 시설",
      "자원순환 관련 시설",
      "교정 및 군사 시설",
      "국방·군사시설",
      "방송통신시설",
      "발전시설",
      "묘지 관련 시설",
      "관광 휴게시설",
      "장례시설",
      "야영장 시설",
    ];
  
    // =========================================================
    // C) 지자체 UI 바인딩
    // =========================================================
    function bindJuris() {
      const addrEl = $("siteAddr");
      const sidoSel = $("jurisSidoSelect");
      const sggSel = $("jurisSigunguSelect");
      const adminDong = $("jurisAdminDong");
      const legalDong = $("jurisLegalDong");
      const override = $("jurisOverride");
  
      if (!addrEl || !sidoSel || !sggSel || !adminDong || !legalDong || !override) return;
  
      // populate sido
      sidoSel.innerHTML = `<option value="">시도 선택…</option>` + SIDO.map(s => `<option value="${s}">${s}</option>`).join("");
  
      function populateSigungu(sido) {
        const list = SIGUNGU[sido] || [];
        sggSel.innerHTML = `<option value="">시군구 선택…</option>` + list.map(x => `<option value="${x}">${x}</option>`).join("");
      }
  
      function setDisabled(disabled) {
        sidoSel.disabled = disabled;
        sggSel.disabled = disabled;
        // 동/상세는 원래 수동이므로 disabled 하지 않음 (요청사항)
        addrEl.readOnly = disabled ? true : false;
        addrEl.classList.toggle("readonly", disabled);
      }
  
      // 주소에서 시도/시군구/동(대충) 파싱(1차)
      function parseFromAddr(addrRaw) {
        const addr = String(addrRaw || "").trim();
        if (!addr) return { sido:"", sigungu:"", dong:"" };
  
        let sido = "";
        for (const s of SIDO) {
          if (addr.startsWith(s)) { sido = s; break; }
        }
        if (!sido) {
          const first = addr.split(/\s+/)[0] || "";
          const map = {
            서울:"서울특별시", 부산:"부산광역시", 대구:"대구광역시", 인천:"인천광역시",
            광주:"광주광역시", 대전:"대전광역시", 울산:"울산광역시", 세종:"세종특별자치시",
            경기:"경기도", 강원:"강원특별자치도", 충북:"충청북도", 충남:"충청남도",
            전북:"전북특별자치도", 전남:"전라남도", 경북:"경상북도", 경남:"경상남도", 제주:"제주특별자치도",
          };
          if (map[first]) sido = map[first];
        }
  
        const tokens = addr.split(/\s+/).filter(Boolean);
        let sigungu = "";
        if (sido && SIGUNGU[sido]) {
          // 목록에서 포함되는 시군구 찾기(최초 1개)
          const list = SIGUNGU[sido];
          sigungu = list.find(x => tokens.includes(x)) || "";
          // 예: "수원시 팔달구" 케이스 보정(서울/부산 제외)
          if (!sigungu) {
            // 토큰 중 "OO시/군/구" 1개만이라도 가져오기
            sigungu = tokens.find(t => /(시|군|구)$/.test(t) && t !== sido) || "";
          }
        } else {
          sigungu = tokens.find(t => /(시|군|구)$/.test(t) && t !== sido) || "";
        }
  
        let dong = "";
        dong = tokens.find(t => /(동|읍|면|리)$/.test(t)) || "";
  
        return { sido, sigungu, dong };
      }
  
      // override OFF일 때 주소로 자동 반영
      let timer = null;
      function autoApplyFromAddr() {
        if (override.checked) return;
        const { sido, sigungu, dong } = parseFromAddr(addrEl.value);
        if (sido) {
          sidoSel.value = sido;
          populateSigungu(sido);
        } else {
          sidoSel.value = "";
          populateSigungu("");
        }
        if (sigungu) sggSel.value = sigungu;
  
        // 동은 "초기 자동 힌트"만 넣고, 사용자가 수동 보정하는 흐름
        if (!adminDong.value) adminDong.value = dong;
        if (!legalDong.value) legalDong.value = dong;
      }
  
      // events
      sidoSel.addEventListener("change", () => {
        populateSigungu(sidoSel.value);
        // 시도 바꾸면 시군구 리셋
        sggSel.value = "";
      });
  
      addrEl.addEventListener("input", () => {
        if (override.checked) return;
        clearTimeout(timer);
        timer = setTimeout(autoApplyFromAddr, 200);
      });
  
      override.addEventListener("change", () => {
        // 직접수정 ON: 주소 자동덮어쓰기 금지(입력만 막지 않고 그대로 두되, 자동반영만 끔)
        setDisabled(false);
        if (!override.checked) autoApplyFromAddr();
      });
  
      // 초기 1회
      populateSigungu("");
      autoApplyFromAddr();
    }
  
    // =========================================================
    // D) 용도(추가/삭제/주용도)
    // =========================================================
    const _uses = []; // [{id,label}]
    function bindUses() {
      const pick = $("usePick");
      const addBtn = $("addUseBtn");
      const chips = $("useChips");
      const primarySel = $("primaryUseSelect");
  
      if (!pick || !addBtn || !chips || !primarySel) return;
  
      // populate pick
      pick.innerHTML = `<option value="">주용도 선택…</option>` + MAIN_USES.map(u => `<option value="${u}">${u}</option>`).join("");
  
      function render() {
        // chips
        chips.innerHTML = "";
        _uses.forEach(u => {
          const el = document.createElement("span");
          el.className = "chip2";
          el.innerHTML = `
            <span>${u.label}</span>
            <button type="button" class="btn-mini btn-danger" data-id="${u.id}">삭제</button>
          `;
          chips.appendChild(el);
        });
  
        chips.querySelectorAll("button[data-id]").forEach(btn => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            if (_uses.length <= 1) {
              alert("용도는 최소 1개는 유지되어야 합니다.");
              return;
            }
            const idx = _uses.findIndex(x => x.id === id);
            if (idx >= 0) _uses.splice(idx, 1);
            // 주용도 유지
            if (!_uses.some(x => x.label === primarySel.value)) {
              primarySel.value = _uses[0]?.label || "";
            }
            render();
            // 용도별면적개요의 용도 셀렉트도 갱신
            refreshUsageAreaRowsUseOptions();
          });
        });
  
        // primary select
        primarySel.innerHTML =
          _uses.length
            ? _uses.map(u => `<option value="${u.label}">${u.label}</option>`).join("")
            : `<option value="">(용도 1개 이상 추가 필요)</option>`;
  
        if (_uses.length && !primarySel.value) primarySel.value = _uses[0].label;
      }
  
      function addUse(label) {
        if (!label) return;
        if (_uses.some(x => x.label === label)) {
          alert("이미 추가된 용도입니다.");
          return;
        }
        _uses.push({ id: cryptoRandomId(), label });
        render();
        refreshUsageAreaRowsUseOptions();
      }
  
      addBtn.addEventListener("click", () => {
        const label = pick.value;
        if (!label) { alert("추가할 용도를 선택하세요."); return; }
        addUse(label);
      });
  
      // 초기 1개 자동
      addUse("업무시설");
    }
  
    function cryptoRandomId() {
      try {
        return crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
      } catch {
        return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
      }
    }
  
    // =========================================================
    // E) 용도별면적개요 테이블
    // - 용도는 선택(현재 추가된 용도 목록 내에서)
    // =========================================================
    const _usageRows = []; // {id,use,area,note}
    function bindUsageAreaTable() {
      const tbody = $("usageAreaTbody");
      const btnAdd = $("addUsageAreaBtn");
      const sumEl = $("usageAreaSum");
      if (!tbody || !btnAdd || !sumEl) return;
  
      function calcSum() {
        let s = 0;
        _usageRows.forEach(r => s += n(r.area));
        sumEl.textContent = format2(s);
        // (요청사항) 이 합계가 연면적계에 직접 반영되게 하진 않음:
        // 연면적계는 "층별면적개요 합계"가 기준(더 안전).
      }
  
      window.refreshUsageAreaRowsUseOptions = function refreshUsageAreaRowsUseOptions() {
        // 행들 다시 렌더해서 옵션 갱신
        render();
      };
  
      function render() {
        tbody.innerHTML = "";
        _usageRows.forEach(r => {
          const tr = document.createElement("tr");
  
          const tdUse = document.createElement("td");
          const sel = document.createElement("select");
          const options = _uses.length ? _uses : [{label:"(용도 없음)"}];
          sel.innerHTML = options.map(u => `<option value="${u.label}">${u.label}</option>`).join("");
          sel.value = r.use || (options[0]?.label || "");
          sel.addEventListener("change", () => { r.use = sel.value; });
          tdUse.appendChild(sel);
  
          const tdArea = document.createElement("td");
          const inpA = document.createElement("input");
          inpA.type = "number";
          inpA.step = "0.01";
          inpA.value = String(r.area ?? "");
          inpA.addEventListener("input", () => { r.area = inpA.value; calcSum(); });
          inpA.addEventListener("blur", () => { inpA.value = format2(inpA.value); r.area = inpA.value; calcSum(); });
          tdArea.appendChild(inpA);
  
          const tdNote = document.createElement("td");
          const inpN = document.createElement("input");
          inpN.value = r.note ?? "";
          inpN.placeholder = "비고(수동)";
          inpN.addEventListener("input", () => { r.note = inpN.value; });
          tdNote.appendChild(inpN);
  
          const tdDel = document.createElement("td");
          const del = document.createElement("button");
          del.type = "button";
          del.className = "btn-mini btn-danger";
          del.textContent = "삭제";
          del.addEventListener("click", () => {
            const idx = _usageRows.findIndex(x => x.id === r.id);
            if (idx >= 0) _usageRows.splice(idx, 1);
            render();
            calcSum();
          });
          tdDel.appendChild(del);
  
          tr.appendChild(tdUse);
          tr.appendChild(tdArea);
          tr.appendChild(tdNote);
          tr.appendChild(tdDel);
          tbody.appendChild(tr);
        });
  
        calcSum();
      }
  
      function addRow() {
        _usageRows.push({
          id: cryptoRandomId(),
          use: _uses[0]?.label || "",
          area: "0",
          note: "",
        });
        render();
      }
  
      btnAdd.addEventListener("click", addRow);
  
      // 초기 1행
      addRow();
    }
  
    // =========================================================
    // F) 층별면적개요: 층추가 + 자동정렬 + 합계(지상/지하) → 연면적 연동
    // =========================================================
    const _floors = []; // {id,type:'roof'|'above'|'below', no:number|null, area, use, structure}
    function bindFloorTable() {
      const tbody = $("floorTbody");
      const btnAdd = $("addFloorBtn");
      if (!tbody || !btnAdd) return;
  
      function floorLabel(f) {
        if (f.type === "roof") return "옥탑";
        if (f.type === "above") return `지상${n(f.no)}층`;
        return `지하${n(f.no)}층`;
      }
  
      function sortFloors() {
        _floors.sort((a, b) => {
          // order: roof(0), above(1), below(2)
          const rank = (x) => (x.type === "roof" ? 0 : x.type === "above" ? 1 : 2);
          const ra = rank(a), rb = rank(b);
          if (ra !== rb) return ra - rb;
  
          // within above: high -> low
          // within below: low -> high (지하1,2,3...)
          const na = n(a.no);
          const nb = n(b.no);
          if (a.type === "above") return nb - na;
          if (a.type === "below") return na - nb;
          return 0;
        });
      }
  
      function calcFloorSums() {
        let aboveSum = 0;
        let belowSum = 0;
        _floors.forEach(f => {
          const area = n(f.area);
          if (f.type === "below") belowSum += area;
          else aboveSum += area; // roof 포함
        });
  
        set2("faAbove", aboveSum);
        set2("faBelow", belowSum);
        set2("faTotal", aboveSum + belowSum);
  
        // 건폐율/용적률 등 갱신
        recalcBuildingOverview();
      }
  
      function render() {
        sortFloors();
        tbody.innerHTML = "";
  
        _floors.forEach(f => {
          const tr = document.createElement("tr");
  
          // 구분(층): 타입 선택 + 층수 입력(roof는 층수 숨김)
          const tdKind = document.createElement("td");
          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.gap = "8px";
          wrap.style.alignItems = "center";
  
          const selType = document.createElement("select");
          selType.innerHTML = `
            <option value="roof">옥탑</option>
            <option value="above">지상</option>
            <option value="below">지하</option>
          `;
          selType.value = f.type;
  
          const inpNo = document.createElement("input");
          inpNo.type = "number";
          inpNo.step = "1";
          inpNo.value = f.no == null ? "" : String(f.no);
          inpNo.placeholder = "층수";
          inpNo.style.width = "110px";
          inpNo.style.textAlign = "right";
  
          const badge = document.createElement("span");
          badge.className = "pill";
          badge.textContent = floorLabel(f);
  
          function syncNoVisibility() {
            const isRoof = selType.value === "roof";
            inpNo.style.display = isRoof ? "none" : "inline-block";
            if (isRoof) f.no = null;
            if (!isRoof && (f.no == null || n(f.no) <= 0)) f.no = 1;
            inpNo.value = f.no == null ? "" : String(f.no);
            badge.textContent = floorLabel(f);
          }
  
          selType.addEventListener("change", () => {
            f.type = selType.value;
            syncNoVisibility();
            render(); // 정렬 반영
            calcFloorSums();
          });
  
          inpNo.addEventListener("input", () => {
            f.no = n(inpNo.value) || 1;
            badge.textContent = floorLabel(f);
          });
          inpNo.addEventListener("blur", () => {
            f.no = n(inpNo.value) || 1;
            inpNo.value = String(f.no);
            badge.textContent = floorLabel(f);
            render(); // 정렬 반영
            calcFloorSums();
          });
  
          wrap.appendChild(selType);
          wrap.appendChild(inpNo);
          wrap.appendChild(badge);
          tdKind.appendChild(wrap);
  
          // 면적
          const tdArea = document.createElement("td");
          const inpA = document.createElement("input");
          inpA.type = "number";
          inpA.step = "0.01";
          inpA.value = String(f.area ?? "0");
          inpA.addEventListener("input", () => { f.area = inpA.value; calcFloorSums(); });
          inpA.addEventListener("blur", () => { inpA.value = format2(inpA.value); f.area = inpA.value; calcFloorSums(); });
          tdArea.appendChild(inpA);
  
          // 주용도(수동)
          const tdUse = document.createElement("td");
          const inpU = document.createElement("input");
          inpU.placeholder = "예: 도서관";
          inpU.value = f.use ?? "";
          inpU.addEventListener("input", () => { f.use = inpU.value; });
          tdUse.appendChild(inpU);
  
          // 구조(수동)
          const tdStr = document.createElement("td");
          const inpS = document.createElement("input");
          inpS.placeholder = "예: 철근콘크리트조";
          inpS.value = f.structure ?? "";
          inpS.addEventListener("input", () => { f.structure = inpS.value; });
          tdStr.appendChild(inpS);
  
          // 삭제
          const tdDel = document.createElement("td");
          const del = document.createElement("button");
          del.type = "button";
          del.className = "btn-mini btn-danger";
          del.textContent = "삭제";
          del.addEventListener("click", () => {
            const idx = _floors.findIndex(x => x.id === f.id);
            if (idx >= 0) _floors.splice(idx, 1);
            render();
            calcFloorSums();
          });
          tdDel.appendChild(del);
  
          tr.appendChild(tdKind);
          tr.appendChild(tdArea);
          tr.appendChild(tdUse);
          tr.appendChild(tdStr);
          tbody.appendChild(tr);
  
          syncNoVisibility();
        });
  
        calcFloorSums();
      }
  
      function addFloor() {
        _floors.push({
          id: cryptoRandomId(),
          type: "above",
          no: 1,
          area: "0",
          use: "",
          structure: "",
        });
        render();
      }
  
      btnAdd.addEventListener("click", addFloor);
  
      // 초기: 지상1층 1개
      addFloor();
    }
  
    // =========================================================
    // G) 건축개요 자동 계산(건폐율/용적률/조경비율)
    // - faTotal은 "층별면적개요 합계"로 자동 채워짐
    // =========================================================
    function recalcBuildingOverview() {
      const site = n($("siteArea")?.value);
      const bArea = n($("bAreaPlan")?.value);
      const total = n($("faTotal")?.value);
  
      const cov = site > 0 ? round2((bArea / site) * 100) : 0;
      set2("covPlan", cov);
  
      const far = site > 0 ? round2((total / site) * 100) : 0;
      set2("farPlan", far);
  
      const landPlan = n($("landPlan")?.value);
      const landRatio = site > 0 ? round2((landPlan / site) * 100) : 0;
      set2("landRatio", landRatio);
    }
  
    // index.html 인라인(지번 합계)에서 호출하는 훅
    window.__recalcBuildingOverview = recalcBuildingOverview;
  
    function bindBuildingOverviewInputs() {
      const ids = ["bAreaPlan", "landPlan", "siteArea"];
      ids.forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener("input", recalcBuildingOverview);
        el.addEventListener("blur", () => {
          if (el.type === "number") el.value = format2(el.value);
          recalcBuildingOverview();
        });
      });
  
      // 주차장면적도 숫자 포맷만
      const p = $("parkingArea");
      if (p) {
        p.addEventListener("blur", () => { p.value = format2(p.value); });
      }
  
      recalcBuildingOverview();
    }
  
    // =========================================================
    // H) (임시) 주차 영역 안내만 유지
    // =========================================================
    function bindParkingPlaceholder() {
      const box = $("parkResultBox");
      if (!box) return;
      // 이번 단계는 주차 자동계산 제외
      if (!box.textContent || box.textContent.trim() === "대기중…") {
        box.textContent = [
          "이번 단계에서는 ‘건축개요 UI(지자체/용도/연면적)’ 정리가 우선입니다.",
          "주차 자동계산은 다음 단계에서 다시 연결합니다."
        ].join("\n");
      }
    }
  
    // ---------- BOOT ----------
    function boot() {
      bindJuris();
      bindUses();
      bindUsageAreaTable();
      bindFloorTable();
      bindBuildingOverviewInputs();
      bindParkingPlaceholder();
    }
  
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  })();