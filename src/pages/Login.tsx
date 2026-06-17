import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KakaoLogin from '../components/KakaoLogin';
import { useAuth } from '../contexts/AuthContext';

type InAppKind = 'kakaotalk' | 'naver' | 'facebook' | 'instagram' | 'line' | null;

const detectInApp = (): InAppKind => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/NAVER\(inapp/i.test(ua)) return 'naver';
  if (/FBAN|FBAV/i.test(ua)) return 'facebook';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/ Line\//i.test(ua)) return 'line';
  return null;
};

const isAndroid = () =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

export const Login = () => {
  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [inApp, setInApp] = useState<InAppKind>(null);

  useEffect(() => {
    setInApp(detectInApp());
  }, []);

  const handleDemoLogin = async () => {
    await loginAsDemo();
    navigate('/club');
  };

  const handleOpenExternal = () => {
    const url = window.location.href;
    if (isAndroid()) {
      // 카카오톡 안드로이드: 외부 브라우저 열기 스킴
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    } else {
      // iOS는 스킴이 막혀있어 수동 안내만 가능
      alert('오른쪽 위 ⋮ 메뉴 → "다른 브라우저로 열기"를 눌러 Safari/Chrome으로 다시 접속해주세요.');
    }
  };

  return (
    <div className="container">
      <div className="login-container">
        <h1>💪 Cardio</h1>
        <p className="login-subtitle">운동과 함께하는 건강한 삶</p>

        {inApp && (
          <div
            style={{
              maxWidth: 400,
              margin: '0 auto 20px',
              padding: '14px 16px',
              backgroundColor: '#FFF8E1',
              border: '1px solid #FFCA28',
              borderRadius: 8,
              textAlign: 'left',
              fontSize: 14,
              lineHeight: 1.5,
              color: '#5d4037',
            }}
          >
            <strong>⚠ 인앱 브라우저에서는 카카오 로그인이 실패할 수 있습니다.</strong>
            <div style={{ marginTop: 6 }}>
              {isAndroid()
                ? '아래 버튼을 눌러 Chrome 등 외부 브라우저로 열어주세요.'
                : '오른쪽 위 ⋮ 메뉴에서 "다른 브라우저로 열기"(Safari)를 선택해주세요.'}
            </div>
            {isAndroid() && (
              <button
                type="button"
                onClick={handleOpenExternal}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#FFA000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                외부 브라우저로 열기
              </button>
            )}
          </div>
        )}

        <KakaoLogin />

        <button className="demo-login-button" onClick={handleDemoLogin}>
          데모 체험하기
        </button>
      </div>
    </div>
  );
};
