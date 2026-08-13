import { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  // 게스트는 anon 세션이라 users 의 PII 컬럼(email/kakao_id 등)을 읽을 수 없다.
  // 표시에 필요한 컬럼만 조회한다. (docs/plans/rls-hardening.md §3-2)
  const { data } = await supabase
    .from('users')
    .select('id, username, display_name, provider, profile_image, is_admin, is_super_admin, is_sub_admin')
    .eq('id', row.user_id)
    .maybeSingle();
  return data ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef<string | null>(null);

  const fetchPublicUser = async (authId: string) => {
    if (fetchingRef.current === authId) {
      diagLog.add('auth', `fetchPublicUser 중복 호출 무시 authId=${authId.slice(0, 8)}`);
      return;
    }
    fetchingRef.current = authId;
    try {
      // users 의 PII 컬럼(email/kakao_id 등)은 컬럼 권한으로 차단돼 있어
      // 직접 select 하면 permission denied 가 난다. 본인 정보는 RPC 로 받는다.
      // (docs/plans/rls-hardening.md §3-3 — RPC 가 auth.uid() 로 본인 행을 찾는다)
      const fetchOnce = async () =>
        (await supabase.rpc('get_my_account').maybeSingle()) as {
          data: User | null;
          error: { message?: string } | null;
        };

      let { data, error } = await fetchOnce();
      if (error || !data) {
        diagLog.add(
          'auth',
          `fetchPublicUser 1차 실패 authId=${authId.slice(0, 8)} error=${error?.message || 'no-row'} — 재시도`
        );
        await new Promise((r) => setTimeout(r, 500));
        const retry = await fetchOnce();
        data = retry.data;
        error = retry.error;
      }

      if (error || !data) {
        // KakaoCallback이 실행되지 않아 public.users row가 없는 경우 폴백:
        // 세션의 kakao identity로 link_or_create_user 직접 호출 후 재조회.
        // (전화번호·생년·성별은 다음 정상 로그인 시 KakaoCallback에서 채워짐)
        diagLog.add(
          'auth',
          `fetchPublicUser no-row authId=${authId.slice(0, 8)} — link_or_create 폴백 시도`
        );
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const kakaoIdentity = session?.user?.identities?.find(i => i.provider === 'kakao');
          const kakaoId = String(
            kakaoIdentity?.identity_data?.sub
              || session?.user?.user_metadata?.provider_id
              || ''
          );

          if (kakaoId) {
            await supabase.rpc('link_or_create_user', {
              p_auth_id:       authId,
              p_kakao_id:      kakaoId,
              p_email:         session?.user?.email ?? null,
              p_display_name:  session?.user?.user_metadata?.name
                               ?? session?.user?.user_metadata?.full_name
                               ?? null,
              p_profile_image: session?.user?.user_metadata?.avatar_url
                               ?? session?.user?.user_metadata?.picture
                               ?? null,
            });
            diagLog.add('auth', `link_or_create_user 폴백 완료 kakaoId=${kakaoId.slice(0, 8)}`);

            const { data: created } = await fetchOnce();
            if (created) {
              diagLog.add('auth', `fetchPublicUser 폴백 성공 userId=${created.id.slice(0, 8)}`);
              setUser(created);
              setLoading(false);
              fetch('/api/sync/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: created.id }),
              }).catch(() => {});
              return;
            }
          } else {
            diagLog.add('auth', 'link_or_create_user 폴백 불가 — kakaoId 없음');
          }
        } catch (rpcErr) {
          diagLog.add('auth', `link_or_create_user 폴백 실패: ${rpcErr instanceof Error ? rpcErr.message : String(rpcErr)}`);
        }

        diagLog.add(
          'auth',
          `fetchPublicUser 최종 실패 authId=${authId.slice(0, 8)} error=${error?.message || 'no-row'} — auth signOut 진행`
        );
        try {
          await supabase.auth.signOut();
        } catch {}
        setUser(null);
        setLoading(false);
        return;
      }

      diagLog.add('auth', `fetchPublicUser 성공 userId=${data.id.slice(0, 8)}`);
      setUser(data);
      setLoading(false);

      fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.id }),
      }).catch(() => {});
    } finally {
      fetchingRef.current = null;
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

    // INITIAL_SESSION 이벤트가 getSession() 역할(초기 세션 복원)을 대체하므로 별도 호출 불필요.
    // onAuthStateChange 단일 구독으로 초기 복원·로그인·로그아웃·토큰 갱신 모두 처리.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      diagLog.add('auth', `onAuthStateChange: ${_event} session=${!!session}`);
      if (session?.user) {
        setLoading(true);
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
    // 네이티브 앱(WebView)이면 자체 토큰/헬스 연동 세션도 정리하도록 알림
    window.CardioNative?.logout?.();
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
