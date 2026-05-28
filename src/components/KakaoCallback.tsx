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

      try {
        // public.users와 auth.users 연결 (기존 계정 매핑 or 신규 생성)
        await supabase.rpc('link_or_create_user', {
          p_auth_id:       authUser.id,
          p_kakao_id:      kakaoId,
          p_email:         authUser.email ?? null,
          p_display_name:  authUser.user_metadata?.name
                           ?? authUser.user_metadata?.full_name
                           ?? null,
          p_profile_image: authUser.user_metadata?.avatar_url
                           ?? authUser.user_metadata?.picture
                           ?? null,
          p_phone_number:  authUser.user_metadata?.phone_number ?? null,
          p_birthyear:     authUser.user_metadata?.birthyear ?? null,
          p_gender:        authUser.user_metadata?.gender ?? null,
        });
      } catch (err) {
        console.error('link_or_create_user 실패:', err);
      }

      const redirectTo = sessionStorage.getItem('redirect_after_login') || '/';
      sessionStorage.removeItem('redirect_after_login');
      navigate(redirectTo, { replace: true });
    };

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
