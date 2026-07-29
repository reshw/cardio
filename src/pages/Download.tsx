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

  // Android 는 Play 내부테스트 opt-in 방식으로 전환됨 (app_releases.url = 테스터 신청 링크).
  // 아직 구 APK URL 이 남아있는 동안 "테스터 신청" 버튼이 APK 를 내려받는 사고를 막기 위해
  // Play 링크일 때만 버튼을 노출한다.
  const playOptInUrl =
    android && /^https:\/\/play\.google\.com\//.test(android.url) ? android.url : null;

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

              <div style={{
                background: '#f4f7ff',
                border: '1px solid #d6e0ff',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13,
                color: '#33427a',
                marginBottom: 16,
                lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Play 스토어 테스터로 설치합니다</div>
                <div>1. 아래 버튼에서 <b>테스터 되기</b>를 눌러 신청</div>
                <div>2. Play 스토어에서 <b>Cardio 설치</b></div>
                <div>3. 이후 업데이트는 Play 스토어가 자동 처리</div>
                <div style={{ marginTop: 6, color: '#6b76a8' }}>
                  신청 직후에는 스토어 반영에 몇 분 걸릴 수 있습니다.
                </div>
              </div>

              {playOptInUrl ? (
                <a
                  href={playOptInUrl}
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
                  }}
                >
                  Play 테스터 신청하기
                </a>
              ) : (
                <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '12px 0' }}>
                  테스터 신청 링크 준비 중입니다
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
