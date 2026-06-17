import { supabase } from '../lib/supabase';

export const KakaoLogin = () => {
  const handleLogin = async () => {
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== '/' && currentPath !== '/auth/callback') {
      sessionStorage.setItem('redirect_after_login', currentPath);
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'profile_nickname profile_image account_email phone_number name birthyear gender',
          queryParams: {
            prompt: 'login', // 매번 계정 선택 강제
          },
        },
      });
      if (error) {
        console.error('[KakaoLogin] signInWithOAuth error:', error);
        alert(`카카오 로그인을 시작할 수 없습니다.\n${error.message}\n\n잠시 후 다시 시도하거나, 카카오톡 인앱 브라우저인 경우 외부 브라우저(Chrome/Safari)로 열어주세요.`);
      }
    } catch (err) {
      console.error('[KakaoLogin] unexpected error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`카카오 로그인 중 오류가 발생했습니다.\n${msg}\n\n외부 브라우저(Chrome/Safari)로 다시 시도해주세요.`);
    }
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
