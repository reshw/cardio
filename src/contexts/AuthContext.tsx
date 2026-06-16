import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
  loginAsDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      fetch('/api/sync/trigger-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.id }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    // 초기 세션 복원 (새로고침·탭 재방문)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchPublicUser(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // 세션 변경 감지 (로그인·로그아웃·토큰 갱신)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const loginAsDemo = async () => {
    const demoId = import.meta.env.VITE_DEMO_USER_ID;
    if (!demoId) {
      alert('데모 로그인이 설정되지 않았습니다. (VITE_DEMO_USER_ID 환경변수 누락)');
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, email, kakao_id, provider, profile_image, is_admin, is_super_admin, is_sub_admin')
      .eq('id', demoId)
      .single();
    if (error || !data) {
      alert(`데모 사용자 조회 실패\n${error?.message ?? '데이터 없음'}`);
      return;
    }
    setUser(data);
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
