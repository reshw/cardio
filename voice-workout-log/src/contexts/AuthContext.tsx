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
    // 로컬스토리지에서 사용자 정보 복원
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
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
      // 1. Supabase Auth 세션 생성 (RLS를 위해 필수)
      // 카카오 ID 기반으로 고유한 이메일/비밀번호 생성
      const authEmail = `kakao_${userData.kakao_id}@internal.app`;
      const authPassword = `kakao_${userData.kakao_id}_secret`;

      // 먼저 signIn 시도
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      // 로그인 실패 시 (사용자가 없으면) signUp
      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              user_id: userData.id, // users 테이블 ID 매핑
            },
          },
        });

        if (signUpError) {
          console.error('Supabase Auth signUp 실패:', signUpError);
          // Auth 실패해도 앱 로그인은 진행 (RLS만 작동 안 함)
        }
      }

      // 2. localStorage에 사용자 정보 저장
      setUser(userData);
      localStorage.setItem('current_user', JSON.stringify(userData));
    } catch (err) {
      console.error('Kakao login error:', err);
      throw err;
    }
  };

  const logout = async () => {
    // Supabase Auth 로그아웃
    await supabase.auth.signOut();

    setUser(null);
    localStorage.removeItem('current_user');
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
