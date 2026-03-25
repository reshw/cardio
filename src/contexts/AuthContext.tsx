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
        // localStorage에서 사용자 정보 복원
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
        .select('id, username, display_name, email, profile_image, is_admin, is_super_admin, is_sub_admin')
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
    setUser(userData);
    localStorage.setItem('current_user', JSON.stringify(userData));
  };

  const logout = () => {
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
