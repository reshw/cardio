import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AppRelease {
  id: number;
  platform: string;
  version: string;
  url: string;
  released_at: string;
}

export const Download = () => {
  const [android, setAndroid] = useState<AppRelease | null>(null);
  const [ios, setIos] = useState<AppRelease | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('app_releases')
      .select('*')
      .order('released_at', { ascending: false })
      .then(({ data }) => {
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

              <div style={{
                background: '#fff8e6',
                border: '1px solid #ffe08a',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#7a5c00',
                marginBottom: 16,
                lineHeight: 1.6,
              }}>
                구글 헬스커넥트 연동이므로, 가민 · Strava · 삼성헬스에서 헬스커넥트 연동을 확인하세요.
              </div>

              {android ? (
                <a
                  href={android.url}
                  download
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
                  }}
                >
                  APK 다운로드
                </a>
              ) : (
                <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '12px 0' }}>
                  준비 중입니다
                </div>
              )}
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

              {ios ? (
                <a
                  href={ios.url}
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
                  }}
                >
                  App Store
                </a>
              ) : (
                <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '12px 0' }}>
                  준비 중입니다
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
