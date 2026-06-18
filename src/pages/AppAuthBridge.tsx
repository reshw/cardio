import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AppAuthBridge() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const refresh = params.get('refresh');
    const redirect = params.get('redirect') || '/';

    if (!token || !refresh) {
      navigate('/', { replace: true });
      return;
    }

    supabase.auth.setSession({
      access_token: token,
      refresh_token: refresh,
    }).then(({ error }) => {
      if (error) {
        console.error('앱 세션 주입 실패:', error);
      }
      navigate(redirect, { replace: true });
    });
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>로그인 중...</div>
    </div>
  );
}
