import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { diagLog } from '../lib/diagLog';

interface User {
  id: string;
  username: string;
  display_name: string;
  email?: string;
  kakao_id?: string;
  provider?: string;
  profile_image?: string;
  is_admin?: boolean;
  is_super_admin?: boolean;
  is_sub_admin?: boolean;
  isGuest?: boolean;
}

const GUEST_FLAG_KEY = 'cardio_guest_tmp';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
  loginAsDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const fetchUserByTmpNumber = async (tmp: number) => {
  const { data: row } = await supabase
    .from('demo_users')
    .select('user_id')
    .eq('tmp_number', tmp)
    .maybeSingle();
  if (!row?.user_id) return null;
  const { data } = await supabase
    .from('users')
    .select('id, username, display_name, email, kakao_id, provider, profile_image, is_admin, is_super_admin, is_sub_admin')
    .eq('id', row.user_id)
    .maybeSingle();
  return data ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPublicUser = async (authId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id, username, display_name, email, kakao_id, provider, profile_image, is_admin, is_super_admin, is_sub_admin')
      .eq('auth_id', authId)
      .maybeSingle();

    setUser(data ?? null);
    setLoading(false);

    if (data?.id) {
      fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.id }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    // 게스트 모드: ?tmp=N 또는 sessionStorage 플래그가 있으면
    // demo_users 테이블의 tmp_number=N → user_id 매핑으로 setUser. supabase auth는 건드리지 않는다.
    const params = new URLSearchParams(window.location.search);
    const tmpParam = params.get('tmp');
    if (tmpParam !== null && /^\d+$/.test(tmpParam)) {
      sessionStorage.setItem(GUEST_FLAG_KEY, tmpParam);
      params.delete('tmp');
      const rest = params.toString();
      const cleanUrl = window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
    const stored = sessionStorage.getItem(GUEST_FLAG_KEY);
    if (stored !== null && /^\d+$/.test(stored)) {
      fetchUserByTmpNumber(Number(stored)).then((data) => {
        setUser(data ? { ...data, isGuest: true } : null);
        setLoading(false);
      });
      return;
    }

    // 초기 세션 복원 (새로고침·탭 재방문)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      diagLog.add('auth', `getSession session=${!!session} error=${error?.message || 'none'}`);
      if (session?.user) {
        fetchPublicUser(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // 세션 변경 감지 (로그인·로그아웃·토큰 갱신)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      diagLog.add('auth', `onAuthStateChange: ${_event} session=${!!session}`);
      if (session?.user) {
        setLoading(true); // fetchPublicUser 완료 전까지 로딩 유지
        fetchPublicUser(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = () => {
    supabase.auth.signOut();
    setUser(null);
    sessionStorage.clear();
  };

  // "데모 체험하기" 버튼 = tmp_number=0 등록된 기본 데모 유저
  const loginAsDemo = async () => {
    const data = await fetchUserByTmpNumber(0);
    if (!data) {
      alert('데모 계정이 등록되지 않았습니다. 관리자에게 문의하세요.');
      return;
    }
    sessionStorage.setItem(GUEST_FLAG_KEY, '0');
    setUser({ ...data, isGuest: true });
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, loginAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
