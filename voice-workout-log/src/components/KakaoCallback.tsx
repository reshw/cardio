// src/components/KakaoCallback.tsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

const KakaoCallback = () => {
  const navigate = useNavigate();
  const { loginWithKakao } = useAuth();

  // React 18 중복 실행 방지
  const once = useRef(false);

  useEffect(() => {
    (async () => {
      if (once.current) return;
      once.current = true;

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const stateStr = url.searchParams.get('state');

      const from = (() => {
        try {
          return JSON.parse(decodeURIComponent(stateStr || ''))?.from || '/';
        } catch {
          return '/';
        }
      })();

      // 코드 중복 사용 방지
      if (code && sessionStorage.getItem(`kakao_code_used_${code}`) === '1') {
        navigate(from, { replace: true });
        return;
      }

      try {
        if (!code) throw new Error('인가 코드(code)가 없습니다.');

        // 1. 카카오로부터 사용자 정보 가져오기
        const userInfo = await authService.getKakaoUserInfo(code);
        console.log('✅ 카카오 유저 정보 받음:', userInfo);

        // 2. 기존 사용자 확인
        const exists = await authService.checkUserExistsByKakaoId(userInfo.id);
        console.log('🔍 사용자 존재 여부:', exists);

        if (!exists) {
          // 신규 사용자 - 회원가입 페이지로 이동
          console.log('🆕 미등록 사용자 - 회원가입 페이지로 이동');
          if (code) sessionStorage.setItem(`kakao_code_used_${code}`, '1');

          navigate('/signup', {
            replace: true,
            state: {
              kakaoUserInfo: userInfo,
              from,
            },
          });
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

        if (code) sessionStorage.setItem(`kakao_code_used_${code}`, '1');
        navigate(from, { replace: true });
      } catch (e) {
        console.error('로그인 실패:', e);
        alert(`로그인에 실패했습니다.\n${e instanceof Error ? e.message : ''}`);

        if (code) sessionStorage.setItem(`kakao_code_used_${code}`, '1');
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate, loginWithKakao]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>카카오 로그인 처리 중...</p>
      </div>
    </div>
  );
};

export default KakaoCallback;
