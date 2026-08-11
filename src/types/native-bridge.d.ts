// 네이티브(Android/iOS) WebView 와 웹 사이의 양방향 브릿지 계약.
// 계약서: docs/plans/native-bridge-theme-and-nav.md
// 협업 인박스 cardio-comms 메시지 #37 (and → web) 에서 시작.

/** 웹 → 네이티브. 네이티브가 로드 전(documentStart)에 주입한다. */
interface CardioNativeBridge {
  /** 로그아웃 버튼 클릭 시 호출 — 네이티브가 자체 토큰/헬스 연동 세션을 정리 */
  logout?: () => void;
  /** 더보기 > 건강 데이터 동기화 관리 클릭 시 호출 — 네이티브가 Health Connect/Apple Health 화면을 연다 */
  openHealthSync?: () => void;
  /**
   * 테마가 정해질 때마다 호출 — 웹뷰 부팅 직후 1회 + 사용자가 토글할 때마다 1회.
   * 네이티브는 이 값으로 상태바·노치 배경·네이티브 탭바를 칠하고, 저장해 뒀다가
   * 다음 실행 때 웹 로드 전에 선반영하고, 살아있는 다른 웹뷰에 CardioWeb.setTheme 으로 전파한다.
   * (<meta name="theme-color"> 는 WKWebView/Android WebView 안에선 효과가 없어 이 채널이 유일하다)
   */
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

/**
 * 네이티브 → 웹. 웹이 전역에 노출한다.
 * iOS 는 탭마다 독립 웹뷰라, 이 채널이 없으면 더보기에서 테마를 바꿔도
 * 이미 떠 있는 다른 탭 웹뷰는 앱 재실행 전까지 옛 테마로 남는다.
 */
interface CardioWebApi {
  /** 같은 값이면 no-op — onThemeChange 가 되쏘여 무한 왕복하는 것을 웹에서 끊는다 */
  setTheme: (theme: 'light' | 'dark') => void;
}

interface Window {
  CardioNative?: CardioNativeBridge;
  CardioWeb?: CardioWebApi;
}
