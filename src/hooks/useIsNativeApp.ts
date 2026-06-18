export function useIsNativeApp(): boolean {
  return navigator.userAgent.includes('cardio-android');
}
