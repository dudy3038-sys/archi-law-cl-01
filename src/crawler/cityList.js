// src/crawler/cityList.js (FULL REPLACE)
// 전국 지자체(시도) 기본 목록 + 표준화 유틸
// - 목표: "국가법령정보센터 조례" 크롤러가 공통으로 쓰는 '지자체 식별/정규화' 레이어
// - 시군구 전체 목록은 너무 방대하므로(전국 단위) 여기서는:
//   1) 시도 목록 제공
//   2) (다음 단계) 크롤링 과정에서 시군구 목록을 자동 수집/캐시하도록 설계
//   3) 지자체 문자열 표준화/키 생성 유틸 제공

export const SIDO_LIST = Object.freeze([
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
  ]);
  
  /**
   * 공백/특수문자 정리: 크롤링 입력이 "경기도 " 처럼 들어와도 안정적으로 처리
   */
  export function cleanText(s) {
    return String(s ?? "")
      .replace(/\u00A0/g, " ") // nbsp
      .replace(/\s+/g, " ")
      .trim();
  }
  
  /**
   * 시도 표준화
   * - "강원도" 같이 옛 명칭이 들어올 수 있어서 최소한의 보정만 제공
   * - (필요시 다음 단계에서 alias 확장 가능)
   */
  export function normalizeSido(input) {
    const s = cleanText(input);
    if (!s) return "";
  
    // 최소 alias
    const alias = {
      "강원도": "강원특별자치도",
      "전라북도": "전북특별자치도",
      "제주도": "제주특별자치도",
      "세종시": "세종특별자치시",
    };
  
    const mapped = alias[s] || s;
  
    // SIDO_LIST에 있는지 확인. 없으면 그대로 반환(크롤러가 탐색을 시도할 수 있게)
    return mapped;
  }
  
  /**
   * 시군구 표준화
   * - "수원시 팔달구" 처럼 띄어쓰기/접미어가 섞여도 clean만 적용
   * - 더 강한 표준화(예: "수원시팔달구")는 오히려 역효과 가능 → 일단 보수적으로
   */
  export function normalizeSigungu(input) {
    return cleanText(input);
  }
  
  /**
   * 지자체 키 생성
   * - 파일/DB 저장 키로 사용 (캐시, 인덱스 등)
   * - 예: "경기도__수원시 팔달구"
   */
  export function jurisdictionKey({ sido, sigungu }) {
    const s1 = normalizeSido(sido);
    const s2 = normalizeSigungu(sigungu);
    return [s1, s2].filter(Boolean).join("__");
  }
  
  /**
   * 입력 유효성 체크
   * - 크롤러 호출 전에 미리 검증용
   */
  export function assertJurisdiction({ sido, sigungu }) {
    const s1 = normalizeSido(sido);
    const s2 = normalizeSigungu(sigungu);
    if (!s1) throw new Error("MISSING_SIDO");
    if (!s2) throw new Error("MISSING_SIGUNGU");
    return { sido: s1, sigungu: s2 };
  }
  
  /**
   * (다음 단계에서 구현될) 시군구 목록 자동 수집/캐시 훅
   * - 국가법령정보센터 조례 페이지에서 시도 선택 → 시군구 옵션이 따라오는 구조를 긁어올 예정
   * - 지금은 인터페이스만 열어둠
   */
  export async function getSigunguListBySido(/* sido */) {
    // 다음 파일(parkingCrawler.js)에서 실제 구현/연결
    return [];
  }