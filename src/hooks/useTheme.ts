import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

/**
 * 테마 저장 키.
 * index.html 의 FOUC 방지 인라인 스크립트가 같은 키를 직접 읽으므로,
 * 이 값을 바꾸면 index.html 도 같이 바꿔야 한다.
 */
const THEME_KEY = 'cardio-theme';

const readStoredTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    // localStorage 차단 환경(사파리 프라이빗 등)
    return 'light';
  }
};

const applyTheme = (theme: Theme) => {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
};

/**
 * 라이트/다크 테마 상태.
 *
 * 최초 적용은 index.html 인라인 스크립트가 이미 해두므로, 여기서는
 * 그 결과를 읽어와 React 상태와 동기화만 한다 (재적용해도 무해).
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setThemeAndPersist = useCallback((next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (err) {
      console.warn('[테마] localStorage 저장 실패 — 이번 세션에만 적용됩니다:', err);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeAndPersist(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setThemeAndPersist]);

  return { theme, isDark: theme === 'dark', setTheme: setThemeAndPersist, toggleTheme };
};
