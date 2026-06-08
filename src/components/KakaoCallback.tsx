import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const KakaoCallback = () => {
  const navigate = useNavigate();
  const processed = useRef(false);

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
        console.error('Kakao ID를 찾을 수 없습니다.', authUser);
        navigate('/', { replace: true });
        return;
      }

      // Kakao /v2/user/me로 실명·전화번호·생년·성별 조회 (provider_token = Kakao access token)
      let displayName: string | null = null;
      let phoneNumber: string | null = null;
      let birthyear: string | null = null;
      let gender: string | null = null;

      if (kakaoAccessToken) {
        try {
          const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${kakaoAccessToken}` },
          });
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
          console.warn('카카오 사용자 정보 조회 실패:', err);
        }
      }

      try {
        // public.users와 auth.users 연결 (기존 계정 매핑 or 신규 생성)
        await supabase.rpc('link_or_create_user', {
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
        });
      } catch (err) {
        console.error('link_or_create_user 실패:', err);
      }

      // RPC 완료 후 세션 갱신 → AuthContext가 public.users를 다시 조회하도록 트리거
      // (SIGNED_IN 시점에 레이스 컨디션으로 user=null이 된 경우 복구)
      await supabase.auth.refreshSession();

      const redirectTo = sessionStorage.getItem('redirect_after_login') || '/';
      sessionStorage.removeItem('redirect_after_login');
      navigate(redirectTo, { replace: true });
    };

    // URL에 에러 파라미터가 있으면 즉시 로그인 페이지로
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      console.error('[KakaoCallback] OAuth error:', params.get('error_description'));
      navigate('/login', { replace: true });
      return;
    }

    // Case 1: 코드 교환이 이미 완료된 경우
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) handleSession(session);
    });

    // Case 2: PKCE 코드 교환이 아직 진행 중인 경우
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
