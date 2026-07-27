import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * 서브페이지가 글로벌 헤더(.app-header)의 좌측 영역을 대신 채우기 위한 슬롯.
 * 서브헤더를 따로 쌓으면 헤더가 60px + 60px로 두 겹이 되어 세로 공간을 잡아먹으므로,
 * 글로벌 헤더가 wrapper 역할을 하고 페이지가 자기 제목/뒤로가기를 여기에 주입한다.
 * 우측 알림/클럽 액션 버튼은 그대로 살아있다.
 */
export interface PageHeaderConfig {
  title: string;
  /** 상위 경로 표시용 (예: '클럽 · 유산소의 모든것') */
  subtitle?: string;
  showBack?: boolean;
}

interface PageHeaderContextValue {
  header: PageHeaderConfig | null;
  setHeader: (config: PageHeaderConfig | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue>({
  header: null,
  setHeader: () => {},
});

export const PageHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [header, setHeader] = useState<PageHeaderConfig | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
};

export const usePageHeaderValue = () => useContext(PageHeaderContext).header;

/**
 * 페이지에서 호출하면 글로벌 헤더가 해당 내용을 표시한다. 언마운트 시 자동 복원.
 */
export const usePageHeader = (config: PageHeaderConfig) => {
  const { setHeader } = useContext(PageHeaderContext);
  const { title, subtitle, showBack } = config;

  useEffect(() => {
    setHeader({ title, subtitle, showBack });
    return () => setHeader(null);
  }, [title, subtitle, showBack, setHeader]);
};
