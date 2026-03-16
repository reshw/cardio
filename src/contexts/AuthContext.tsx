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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  loginWithKakao: (userData: User) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // localStorage에서 사용자 정보 복원 (우선)
        const savedUser = localStorage.getItem('current_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string) => {
    try {
      // Supabase에서 사용자 조회
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, email')
        .eq('username', username)
        .single();

      if (error) throw error;
      if (!data) throw new Error('사용자를 찾을 수 없습니다.');

      setUser(data);
      localStorage.setItem('current_user', JSON.stringify(data));
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const loginWithKakao = async (userData: User) => {
    try {
      // Supabase Auth 세션 생성 시도 (RLS용, 실패해도 무시)
      const authEmail = `kakao_${userData.kakao_id}@internal.app`;
      const authPassword = `kakao_${userData.kakao_id}_secret_key_2024`;

      // 먼저 기존 세션이 있는지 확인
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // 로그인 시도 (모든 에러 무시)
          try {
            await supabase.auth.signInWithPassword({
              email: authEmail,
              password: authPassword,
            });
          } catch {
            // 로그인 실패 시 회원가입 시도
            try {
              await supabase.auth.signUp({
                email: authEmail,
                password: authPassword,
                options: {
                  data: {
                    user_id: userData.id,
                  },
                },
              });
            } catch {
              // 모든 Auth 에러 무시
            }
          }
        }
      } catch {
        // getSession 에러도 무시
      }

      // localStorage에 사용자 정보 저장
      setUser(userData);
      localStorage.setItem('current_user', JSON.stringify(userData));
    } catch {
      // 최종 fallback: 어떤 에러든 무시하고 로그인 진행
      setUser(userData);
      localStorage.setItem('current_user', JSON.stringify(userData));
    }
  };

  const logout = async () => {
    try {
      // Supabase Auth 로그아웃 (에러 무시)
      await supabase.auth.signOut();
    } catch {
      // 에러 무시
    }

    setUser(null);
    localStorage.removeItem('current_user');

    // sessionStorage도 모두 초기화 (카카오 코드 캐시 등)
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithKakao, logout }}>
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
