import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AppRelease {
  id: number;
  platform: string;
  version: string;
  url: string;
  released_at: string;
}

// 스토어 링크는 app_releases 에서 받아 쓰고, 행이 없거나 조회가 실패해도
// 출시된 앱을 "준비 중"으로 보여주지 않도록 상수로 폴백한다.
// (InviteLanding.tsx 와 같은 패턴 — 링크가 바뀌면 두 곳을 함께 고칠 것)
const ANDROID_STORE_FALLBACK = 'https://play.google.com/store/apps/details?id=com.reshw.cardio';
const IOS_STORE_FALLBACK = 'https://apps.apple.com/kr/app/cardioxclub/id6779019606';

export const Download = () => {
  const [android, setAndroid] = useState<AppRelease | null>(null);
  const [ios, setIos] = useState<AppRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('app_releases')
      .select('*')
      .order('released_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[다운로드] 릴리스 조회 실패 상세:', JSON.stringify(error), error);
          setError(`릴리스 정보를 불러오지 못했습니다: ${error.message || error.hint || JSON.stringify(error)}`);
        }
        setAndroid(data?.find(r => r.platform === 'android') ?? null);
        setIos(data?.find(r => r.platform === 'ios') ?? null);
        setLoading(false);
      });
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="container" style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '48px 20px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
            💪 Cardio 앱 다운로드
          </h1>
          <p style={{ color: '#666', fontSize: 15 }}>운동과 함께하는 건강한 삶</p>
        </div>

        {error && (
          <div style={{
            background: '#fff1f0',
            border: '1px solid #ffc9c4',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            color: '#a8271b',
            marginBottom: 16,
            lineHeight: 1.6,
            wordBreak: 'break-all',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>불러오는 중...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Android */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <img
                  src="https://cdn.simpleicons.org/android/3DDC84"
                  alt="Android"
                  style={{ width: 32, height: 32 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>Android</div>
                  {android && (
                    <div style={{ fontSize: 13, color: '#888' }}>
                      v{android.version} · {formatDate(android.released_at)}
                    </div>
                  )}
                </div>
              </div>

              <a
                href={android?.url || ANDROID_STORE_FALLBACK}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #3DDC84, #00b894)',
                  color: '#fff',
                  padding: '13px 0',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 15,
                  textDecoration: 'none',
                  marginBottom: 14,
                }}
              >
                Google Play
              </a>

              <div style={{ fontSize: 12.5, color: '#888', textAlign: 'center', marginBottom: 16 }}>
                스토어 검색: <strong style={{ color: '#555' }}>카디오x클럽</strong>
              </div>

              <div style={{
                background: '#fff8e6',
                border: '1px solid #ffe08a',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#7a5c00',
                lineHeight: 1.6,
              }}>
                구글 헬스커넥트 연동이므로, 가민 · Strava · 삼성헬스에서 헬스커넥트 연동을 확인하세요.
              </div>
            </div>

            {/* iOS */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <img
                  src="https://cdn.simpleicons.org/apple/000000"
                  alt="iOS"
                  style={{ width: 32, height: 32 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>iOS</div>
                  {ios && (
                    <div style={{ fontSize: 13, color: '#888' }}>
                      v{ios.version} · {formatDate(ios.released_at)}
                    </div>
                  )}
                </div>
              </div>

              <a
                href={ios?.url || IOS_STORE_FALLBACK}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #1a1a1a, #444)',
                  color: '#fff',
                  padding: '13px 0',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 15,
                  textDecoration: 'none',
                  marginBottom: 14,
                }}
              >
                App Store
              </a>

              {/* App Store 리스팅 언어가 영어라 한글로 검색하면 안 나온다 */}
              <div style={{ fontSize: 12.5, color: '#888', textAlign: 'center' }}>
                스토어 검색: <strong style={{ color: '#555' }}>CardioXclub</strong> (영문)
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
