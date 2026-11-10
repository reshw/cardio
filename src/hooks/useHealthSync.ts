import { useEffect, useSyncExternalStore } from 'react';

/**
 * 헬스(Apple Health / Health Connect) 자동 동기화 on/off.
 *
 * 이 기능은 **네이티브 앱 안에서만** 의미가 있다. 일반 브라우저에는
 * `window.CardioNative` 자체가 없으므로 `available === false` 가 되고,
 * 더보기 화면은 토글을 아예 렌더하지 않는다.
 *
 * iOS / Android 를 코드에서 분기하지 않는다 — 각 플랫폼이 준비되는 대로
 * `window.CardioNative.setHealthSyncEnabled` 를 주입하면 그 플랫폼에서만
 * 토글이 나타난다 (iOS 빌드 47 부터, Android 는 대응되는 대로).
 *
 * 계약: cardio-comms #107 (app → web)
 *  - CardioNative.healthSyncEnabled: boolean        (로드 시 1회 주입)
 *  - CardioNative.setHealthSyncEnabled(enabled)     (웹 → 네이티브 변경 요청)
 *  - CardioWeb.setHealthSyncEnabled(enabled)        (네이티브 → 웹 결과 반영)
 */

type State = { available: boolean; enabled: boolean };

const readFromBridge = (): State => {
  try {
    return {
      available: typeof window.CardioNative?.setHealthSyncEnabled === 'function',
      enabled: window.CardioNative?.healthSyncEnabled === true,
    };
  } catch {
    return { available: false, enabled: false };
  }
};

// 모듈 레벨 스토어 — 네이티브가 React 트리 밖에서 CardioWeb.setHealthSyncEnabled 를
// 호출하므로 전역 진입점이 필요하다 (useTheme 과 같은 구조).
let state: State = readFromBridge();
const listeners = new Set<() => void>();

const emit = (next: State) => {
  if (next.available === state.available && next.enabled === state.enabled) return;
  state = next;
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// 네이티브가 이 콜백을 호출한다는 것 자체가 브릿지가 살아있다는 뜻 → available: true
const setEnabledGlobal = (enabled: boolean) => emit({ available: true, enabled });
const refreshFromBridge = () => emit(readFromBridge());

// 네이티브 → 웹 인바운드 채널. 기존 CardioWeb(테마) 를 덮지 않고 병합한다.
if (typeof window !== 'undefined') {
  window.CardioWeb = {
    ...window.CardioWeb,
    setHealthSyncEnabled: setEnabledGlobal,
  } as typeof window.CardioWeb;
}

export const useHealthSync = () => {
  const snap = useSyncExternalStore(subscribe, () => state, () => state);

  // 모듈 평가 시점에 브릿지가 아직 주입 전이었을 수 있다(네이티브가 documentStart 미준수).
  // 마운트 후 한 번 더 읽어 available/enabled 를 맞춘다.
  useEffect(() => { refreshFromBridge(); }, []);

  const setEnabled = (next: boolean) => {
    try {
      window.CardioNative?.setHealthSyncEnabled?.(next);
    } catch (err) {
      console.warn('[헬스동기화] setHealthSyncEnabled 호출 실패:', err);
    }
    // 낙관적 반영 — 네이티브가 CardioWeb.setHealthSyncEnabled 로 확정값을 되쏜다.
    setEnabledGlobal(next);
  };

  return { available: snap.available, enabled: snap.enabled, setEnabled };
};
