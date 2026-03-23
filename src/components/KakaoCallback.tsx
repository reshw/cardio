// src/components/KakaoCallback.tsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

const KakaoCallback = () => {
  const navigate = useNavigate();
  const { loginWithKakao } = useAuth();

  // React 18 중복 실행 및 동시 실행 방지
  const once = useRef(false);
  const processing = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // 이미 실행 중이거나 완료된 경우 즉시 반환
      if (once.current || processing.current) return;
      once.current = true;
      processing.current = true;

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const stateStr = url.searchParams.get('state');

      // 1순위: sessionStorage의 redirect_after_login
      // 2순위: state의 from
      // 3순위: 기본값 '/'
      const from = (() => {
        const redirectPath = sessionStorage.getItem('redirect_after_login');
        if (redirectPath) {
          sessionStorage.removeItem('redirect_after_login');
          return redirectPath;
        }

        try {
          return JSON.parse(decodeURIComponent(stateStr || ''))?.from || '/';
        } catch {
          return '/';
        }
      })();

      // 코드가 없는 경우
      if (!code) {
        console.error('인가 코드(code)가 없습니다.');
        navigate('/', { replace: true });
        return;
      }

      // 코드 중복 사용 방지 - 이미 사용된 코드인지 확인
      const codeKey = `kakao_code_used_${code}`;
      if (sessionStorage.getItem(codeKey) === '1') {
        console.warn('이미 사용된 인가 코드입니다. 리다이렉트합니다.');
        navigate(from, { replace: true });
        return;
      }

      // 코드 사용 표시 (API 호출 전에 먼저 표시하여 중복 방지)
      sessionStorage.setItem(codeKey, '1');

      // URL에서 code 제거하여 새로고침 시 재사용 방지
      window.history.replaceState({}, document.title, window.location.pathname);

      try {
        // 1. 카카오로부터 사용자 정보 가져오기
        const userInfo = await authService.getKakaoUserInfo(code);
        console.log('✅ 카카오 유저 정보 받음:', userInfo);

        // 2. 기존 사용자 확인
        const exists = await authService.checkUserExistsByKakaoId(userInfo.id);
        console.log('🔍 사용자 존재 여부:', exists);

        if (!exists) {
          // 신규 사용자 - 자동 회원가입 처리
          console.log('🆕 신규 사용자 - 자동 회원가입 처리');

          const newUser = await authService.registerKakaoUser(userInfo);
          console.log('✅ 회원가입 완료:', newUser);

          await loginWithKakao(newUser);
          console.log('✅ 로그인 완료');

          navigate(from, { replace: true });
          return;
        }

        // 3. 기존 사용자 - 프로필 업데이트 후 로그인
        console.log('👤 기존 사용자 - 로그인 처리');

        await authService.updateUserProfile(userInfo.id, {
          displayName: userInfo.displayName,
          nickname: userInfo.nickname,
          profileImage: userInfo.profileImage,
          email: userInfo.email,
          phoneNumber: userInfo.phoneNumber || '',
          birthyear: userInfo.birthyear || '',
          gender: userInfo.gender || '',
        });

        // 사용자 정보 조회
        const userData = await authService.getUserByKakaoId(userInfo.id);
        await loginWithKakao(userData);

        navigate(from, { replace: true });
      } catch (e) {
        console.error('로그인 실패:', e);

        // KOE320 오류 (인가 코드 재사용) 처리
        if (e instanceof Error && e.message.includes('KOE320')) {
          console.warn('인가 코드가 이미 사용되었습니다.');
          // 코드 사용 표시는 이미 했으므로 그냥 리다이렉트
          navigate(from, { replace: true });
          return;
        }

        alert(`로그인에 실패했습니다.\n${e instanceof Error ? e.message : ''}`);
        navigate('/', { replace: true });
      } finally {
        processing.current = false;
      }
    };

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열: 컴포넌트 마운트 시 한 번만 실행

  return (
    <div className="container">
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>카카오 로그인 처리 중...</p>
      </div>
    </div>
  );
};

export default KakaoCallback;
