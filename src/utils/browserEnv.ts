/**
 * 실행 환경 판별 공용 유틸.
 *
 * 원래 Login.tsx 지역 함수였는데, 초대 게이트웨이(InviteLanding)가 같은 판별을 필요로 해서
 * 승격했다. 새로 판별 로직을 만들지 말고 여기에 추가할 것.
 * 설계: docs/plans/kakao-invite-app-onboarding.md
 */

export type Platform = 'ios' | 'android' | 'desktop';

/** 외부 앱의 인앱 브라우저 종류. null 이면 일반 브라우저. */
export type InAppKind = 'kakaotalk' | 'naver' | 'facebook' | 'instagram' | 'line' | null;

export const detectInApp = (): InAppKind => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/NAVER\(inapp/i.test(ua)) return 'naver';
  if (/FBAN|FBAV/i.test(ua)) return 'facebook';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/ Line\//i.test(ua)) return 'line';
  return null;
};

export const getPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  // iPadOS 13+ 는 데스크톱 Safari 로 위장하므로 터치 포인트로 한 번 더 본다
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
};

export const isIOS = () => getPlatform() === 'ios';
export const isAndroid = () => getPlatform() === 'android';

/**
 * Cardio 네이티브 앱(Android/iOS) WebView 안에서 실행 중인지.
 * 판별 기준은 useIsNativeApp() 훅과 동일하다 — 훅을 쓸 수 없는 곳(유틸 함수 내부)에서 쓴다.
 */
export const isNativeApp = (): boolean =>
  typeof window !== 'undefined' &&
  (!!window.CardioNative || navigator.userAgent.includes('cardio-android'));
