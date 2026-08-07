// 네이티브(Android/iOS) WebView가 로드 시 주입하는 브릿지 객체.
// 존재 여부로 네이티브 앱 여부를 판별한다 — User-Agent 파싱보다 안정적.
// 협업 인박스 cardio-comms 메시지 #37 (and → web) 계약.
interface CardioNativeBridge {
  /** 로그아웃 버튼 클릭 시 호출 — 네이티브가 자체 토큰/헬스 연동 세션을 정리 */
  logout?: () => void;
  /** 더보기 > 건강 데이터 동기화 관리 클릭 시 호출 — 네이티브가 Health Connect/Apple Health 화면을 연다 */
  openHealthSync?: () => void;
}

interface Window {
  CardioNative?: CardioNativeBridge;
}
