import { supabase } from '../lib/supabase';

export const KakaoLogin = () => {
  const handleLogin = async () => {
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== '/' && currentPath !== '/auth/callback') {
      sessionStorage.setItem('redirect_after_login', currentPath);
    }

    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'profile_nickname profile_image account_email phone_number name birthyear gender',
        queryParams: {
          prompt: 'login', // 매번 계정 선택 강제
        },
      },
    });
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
