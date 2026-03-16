// src/components/KakaoLogin.tsx
export const KakaoLogin = () => {
  const handleLogin = () => {
    const REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;

    if (!REST_API_KEY) {
      alert('카카오 API 키가 설정되지 않았습니다.');
      return;
    }

    // 현재 접속 중인 호스트로 리다이렉트 URI 동적 생성
    const currentOrigin = window.location.origin;
    const REDIRECT_URI = `${currentOrigin}/auth/kakao/callback`;

    // 현재 경로를 state로 전달
    const currentPath = window.location.pathname;
    const state = encodeURIComponent(JSON.stringify({ from: currentPath }));

    console.log('🔑 카카오 로그인 리다이렉트 URI:', REDIRECT_URI);
    console.log('🔑 원래 경로 (state):', currentPath);

    const kakaoURL =
      `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&state=${state}`;

    window.location.href = kakaoURL;
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="kakao-login-button"
    >
      <span className="kakao-icon">💬</span>
      카카오 로그인하기
    </button>
  );
};

export default KakaoLogin;
