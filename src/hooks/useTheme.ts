import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

/**
 * 테마 저장 키.
 * index.html 의 FOUC 방지 인라인 스크립트가 같은 키를 직접 읽으므로,
 * 이 값을 바꾸면 index.html 도 같이 바꿔야 한다.
 */
const THEME_KEY = 'cardio-theme';

/**
 * iOS Safari 는 이 값으로 상태바·주소창 주변을 칠한다.
 * (index.html 의 부팅 스크립트도 같은 값을 세팅한다 — 바꾸면 양쪽 다 수정할 것)
 *
 * 주의: WKWebView / Android WebView **안에서는 효과가 없다.**
 * 네이티브 앱 크롬(상태바·노치·탭바) 색은 아래 notifyNative 브릿지가 담당한다.
 */
const THEME_COLOR = { light: '#FFFFFF', dark: '#0F1115' } as const;

const readStoredTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    // localStorage 차단 환경(사파리 프라이빗 등)
    return 'light';
  }
};

/*
 * 모듈 레벨 스토어.
 *
 * 컴포넌트 지역 state 로 두면 useTheme 을 쓰는 화면(더보기)에서만 테마 로직이 돌아,
 * 다른 탭에서 진입했을 때 네이티브 통지가 나가지 않는다. 또 네이티브가 밀어 넣는
 * CardioWeb.setTheme 은 React 트리 밖에서 호출되므로 전역 진입점이 필요하다.
 */
let currentTheme: Theme = readStoredTheme();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 웹 → 네이티브 통지. 브릿지가 없으면(일반 브라우저) 조용히 넘어간다. */
const notifyNative = (theme: Theme) => {
  try {
    window.CardioNative?.onThemeChange?.(theme);
  } catch (err) {
    console.warn('[테마] 네이티브 onThemeChange 호출 실패:', err);
  }
};

const applyTheme = (theme: Theme) => {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
  notifyNative(theme);
};

/**
 * 테마 변경의 유일한 진입점 (사용자 토글 · 네이티브 인바운드 공용).
 *
 * 같은 값이면 no-op 인 것이 중요하다 — 네이티브가 CardioWeb.setTheme 으로 밀어넣은 값을
 * 웹이 다시 onThemeChange 로 돌려보내 무한 왕복하는 것을 여기서 끊는다.
 */
const setThemeGlobal = (next: Theme) => {
  if (next === currentTheme) return;
  currentTheme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (err) {
    console.warn('[테마] localStorage 저장 실패 — 이번 세션에만 적용됩니다:', err);
  }
  applyTheme(next);
  listeners.forEach((listener) => listener());
};

// 네이티브 → 웹 인바운드 채널 등록. 모듈 로드 시점에 열어 둬야
// 네이티브가 React 마운트를 기다리지 않고 바로 밀어넣을 수 있다.
window.CardioWeb = { setTheme: setThemeGlobal };

// 부팅 직후 1회 통지. DOM 적용 자체는 index.html 스크립트가 이미 했으므로 재적용은 무해하고,
// 실제 목적은 네이티브에 현재 테마를 알리는 것이다.
applyTheme(currentTheme);

/**
 * 라이트/다크 테마 상태.
 *
 * 최초 DOM 적용은 index.html 인라인 스크립트가 이미 해두므로, 여기서는
 * 그 결과를 읽어와 React 상태와 동기화만 한다.
 */
export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, () => currentTheme);

  // 안전망: 모듈 평가 시점에 브릿지가 아직 주입 전이었다면(네이티브가 documentStart 를
  // 지키지 않는 경우) 위의 부팅 통지가 유실된다. 마운트 시 한 번 더 알린다.
  useEffect(() => {
    notifyNative(currentTheme);
  }, []);

  const setTheme = useCallback((next: Theme) => setThemeGlobal(next), []);

  const toggleTheme = useCallback(
    () => setThemeGlobal(currentTheme === 'dark' ? 'light' : 'dark'),
    []
  );

  return { theme, isDark: theme === 'dark', setTheme, toggleTheme };
};
