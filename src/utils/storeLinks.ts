/**
 * 앱 스토어 링크 — 고정값. 링크가 바뀌면 여기 한 곳만 고친다.
 * Download / InviteLanding / StartGuide 가 공유.
 *
 * ⚠️ app_releases.url 을 스토어 링크로 쓰지 말 것. android 행의 url 은 Play 출시 이전 자체 배포하던
 * APK(supabase storage 의 cardio-latest.apk) 라서, 그걸 쓰면 "Google Play" 버튼이 APK 다운로드로 간다
 * (2026-11-17 실제 발생). app_releases 는 버전 표시용으로만 쓴다.
 */
export const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.reshw.cardio';
export const IOS_STORE_URL = 'https://apps.apple.com/kr/app/cardioxclub/id6779019606';

export const STORE_URLS = { ios: IOS_STORE_URL, android: ANDROID_STORE_URL } as const;
