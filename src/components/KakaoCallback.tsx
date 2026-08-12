import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { diagLog } from '../lib/diagLog';
import type { Session } from '@supabase/supabase-js';

const KakaoCallback = () => {
  const navigate = useNavigate();
  const processed = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleSession = async (session: Session) => {
      if (processed.current) return;
      processed.current = true;

      const authUser = session.user;
      const kakaoAccessToken = session.provider_token;

      // Kakao ID: identities 배열에서 추출 (Supabase가 provider_id로 저장)
      const kakaoIdentity = authUser.identities?.find(i => i.provider === 'kakao');
      const kakaoId = String(
        kakaoIdentity?.identity_data?.sub
          || authUser.user_metadata?.provider_id
          || ''
      );

      if (!kakaoId) {
        console.error('[KakaoCallback] Kakao ID를 찾을 수 없습니다.', authUser);
        setErrorMsg('카카오 계정 정보를 가져올 수 없습니다. 다시 시도해주세요.');
        return;
      }

      // 아래 단계들(카카오 프로필 조회 → RPC → 세션갱신) 중 하나라도 응답 없이 멈추면
      // processed.current 가 이미 true라 30초 타임아웃도 다시 안 걸려서 "로그인 처리
      // 중..."에 원인 표시 없이 영원히 멈추는 문제가 있었다(2026-08-12 제보). 각 단계에
      // 자체 타임아웃을 걸어 반드시 에러가 뜨거나 다음 단계로 넘어가게 한다.
      // supabase.rpc(...) 는 PostgrestFilterBuilder(thenable)라 Promise<T> 가 아니라
      // PromiseLike<T> 로 받아야 한다.
      const withTimeout = <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> =>
        Promise.race([
          Promise.resolve(p),
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} 시간 초과(${ms}ms)`)), ms)),
        ]);

      // Kakao /v2/user/me로 실명·전화번호·생년·성별 조회 (provider_token = Kakao access token)
      // 부가 정보일 뿐이라 실패/지연돼도 로그인 자체는 계속 진행한다.
      let displayName: string | null = null;
      let phoneNumber: string | null = null;
      let birthyear: string | null = null;
      let gender: string | null = null;

      if (kakaoAccessToken) {
        try {
          const meRes = await withTimeout(
            fetch('https://kapi.kakao.com/v2/user/me', {
              headers: { Authorization: `Bearer ${kakaoAccessToken}` },
            }),
            8000,
            '카카오 프로필 조회'
          );
          if (meRes.ok) {
            const meData = await meRes.json();
            const account = meData?.kakao_account || {};
            const profile = account?.profile || {};
            displayName = account?.name || profile?.nickname || null;
            phoneNumber = account?.phone_number || null;
            birthyear = account?.birthyear || null;
            gender = account?.gender || null;
          }
        } catch (err) {
          console.warn('[KakaoCallback] 카카오 사용자 정보 조회 실패/시간초과:', err);
          diagLog.add('kakao-callback', `카카오 프로필 조회 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      try {
        // public.users와 auth.users 연결 (기존 계정 매핑 or 신규 생성) — 이건 실패하면
        // 로그인을 계속 진행할 수 없으므로(계정 매핑이 안 됨) 타임아웃 시 명확한 에러로 중단.
        await withTimeout(
          supabase.rpc('link_or_create_user', {
            p_auth_id:       authUser.id,
            p_kakao_id:      kakaoId,
            p_email:         authUser.email ?? null,
            p_display_name:  displayName
                             ?? authUser.user_metadata?.name
                             ?? authUser.user_metadata?.full_name
                             ?? null,
            p_profile_image: authUser.user_metadata?.avatar_url
                             ?? authUser.user_metadata?.picture
                             ?? null,
            p_phone_number:  phoneNumber,
            p_birthyear:     birthyear,
            p_gender:        gender,
          }),
          10000,
          '계정 연결(link_or_create_user)'
        );
      } catch (err: any) {
        console.error('[KakaoCallback] link_or_create_user 실패:', JSON.stringify(err), err);
        diagLog.add('kakao-callback', `link_or_create_user 실패: ${err?.message || JSON.stringify(err)}`);
        setErrorMsg(`계정 연결 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
        return;
      }

      // 예전엔 여기서 supabase.auth.refreshSession() 을 불렀다 — "SIGNED_IN 시점에
      // AuthContext가 아직 public.users를 못 찾은 경우 복구용"이라는 의도였는데,
      // 2026-08-12 diagLog 실측 결과 fetchPublicUser 는 이미 SIGNED_IN/INITIAL_SESSION
      // 단계에서 성공하고 있었고(refreshSession 필요 없음), 그 직후 refreshSession 이
      // 발급한 TOKEN_REFRESHED 로부터 ~0.7초 뒤 아무도 호출 안 한 SIGNED_OUT 이 떠서
      // 로그인 화면으로 튕겨나가는 게 실제로 관찰됐다(refresh token rotation 충돌로
      // 추정). AuthContext 쪽에 이미 자체 재시도·폴백(link_or_create_user) 로직이
      // 있으므로 여기서 억지로 세션을 갱신할 필요가 없어 제거한다.

      const redirectTo = sessionStorage.getItem('redirect_after_login') || '/';
      sessionStorage.removeItem('redirect_after_login');
      navigate(redirectTo, { replace: true });
    };

    diagLog.add('kakao-callback', `진입 URL=${window.location.href.slice(0, 120)}`);

    // URL에 에러 파라미터가 있으면 즉시 에러 표시
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const oauthError = params.get('error') || hashParams.get('error');
    const oauthErrorDesc = params.get('error_description') || hashParams.get('error_description');
    const hasCode = !!params.get('code');
    diagLog.add('kakao-callback', `code=${hasCode} error=${oauthError || 'none'}`);
    if (oauthError) {
      diagLog.add('kakao-callback', `OAuth 에러: ${oauthErrorDesc || oauthError}`);
      console.error('[KakaoCallback] OAuth error:', oauthError, oauthErrorDesc);
      setErrorMsg(`로그인 실패: ${oauthErrorDesc || oauthError}`);
      return;
    }

    // Case 1: 코드 교환이 이미 완료된 경우
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        diagLog.add('kakao-callback', `getSession 에러: ${error.message}`);
        console.error('[KakaoCallback] getSession error:', error);
      }
      diagLog.add('kakao-callback', `getSession session=${!!session}`);
      if (session) handleSession(session);
    });

    // Case 2: PKCE 코드 교환이 아직 진행 중인 경우
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      diagLog.add('kakao-callback', `authStateChange: ${event} session=${!!session}`);
      console.log('[KakaoCallback] authStateChange:', event, !!session);
      if (session) handleSession(session);
    });

    // 30초 타임아웃: 코드 교환이 끝까지 안 되면 에러 표시
    const timeout = window.setTimeout(() => {
      if (!processed.current) {
        diagLog.add('kakao-callback', '30s 타임아웃 — 세션 미수신');
        console.error('[KakaoCallback] 30s timeout — code exchange가 완료되지 않음');
        setErrorMsg('로그인 응답을 받지 못했습니다. 카카오톡 인앱 브라우저인 경우 외부 브라우저(Chrome/Safari)로 다시 시도해주세요.');
      }
    }, 30000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  if (errorMsg) {
    return (
      <div className="container">
        <div className="login-container">
          <h1>💪 Cardio</h1>
          <p style={{ color: '#d32f2f', marginTop: 16, marginBottom: 16, lineHeight: 1.5 }}>
            {errorMsg}
          </p>
          <button
            type="button"
            className="kakao-login-button"
            onClick={() => navigate('/', { replace: true })}
          >
            로그인 화면으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>로그인 처리 중...</p>
      </div>
    </div>
  );
};

export default KakaoCallback;
