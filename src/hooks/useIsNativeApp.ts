/**
 * 네이티브 앱(Android/iOS) WebView 안에서 실행 중인지.
 *
 * 기준은 네이티브가 주입하는 `window.CardioNative` 객체 하나다 — iOS 는 User-Agent 에
 * `cardio-android` 가 없어 UA 파싱으로는 잡히지 않는다.
 * 네이티브는 첫 스크립트 실행 전에 주입해야 한다 (iOS: WKUserScript atDocumentStart,
 * Android: 페이지 로드 전 addJavascriptInterface). 늦으면 첫 렌더에 바텀네비가 번쩍인다.
 *
 * UA 조건은 브릿지를 주입하지 않는 기존 배포 Android 앱을 위한 하위호환 fallback.
 */
export function useIsNativeApp(): boolean {
  return !!window.CardioNative || navigator.userAgent.includes('cardio-android');
}
