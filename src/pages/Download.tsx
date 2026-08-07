import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendTesterApplicationEmail } from '../utils/email';

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

  // 비공개 테스트(Alpha) — 신청 즉시 등록이 아니라 이메일을 받아 관리자가 수동으로 추가
  const [testerEmail, setTesterEmail] = useState('');
  const [testerSubmitting, setTesterSubmitting] = useState(false);
  const [testerSubmitted, setTesterSubmitted] = useState(false);
  const [testerError, setTesterError] = useState<string | null>(null);

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

  const handleTesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = testerEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setTesterError('올바른 이메일 주소를 입력해주세요.');
      return;
    }
    setTesterSubmitting(true);
    setTesterError(null);
    try {
      await sendTesterApplicationEmail(trimmed);
      setTesterSubmitted(true);
    } catch (err: any) {
      console.error('[다운로드] 테스터 신청 접수 실패 상세:', JSON.stringify(err), err);
      setTesterError(`접수 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setTesterSubmitting(false);
    }
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
                <div style={{ fontWeight: 700, marginBottom: 6 }}>지금은 비공개 테스트 중입니다</div>
                <div>1. 아래에 Google Play 계정 이메일을 남겨주세요</div>
                <div>2. 검토 후 비공개 테스트 명단에 개별로 추가해드립니다</div>
                <div>3. 추가되면 별도로 Play 스토어 참여 링크를 안내해드려요</div>
              </div>

              {testerSubmitted ? (
                <div style={{
                  textAlign: 'center',
                  background: '#f0fdf6',
                  border: '1px solid #b7ebc9',
                  color: '#1a7a45',
                  borderRadius: 10,
                  padding: '13px 0',
                  fontWeight: 600,
                  fontSize: 14,
                }}>
                  신청이 접수되었습니다. 검토 후 개별로 연락드릴게요 🙌
                </div>
              ) : (
                <form onSubmit={handleTesterSubmit}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      value={testerEmail}
                      onChange={(e) => { setTesterEmail(e.target.value); setTesterError(null); }}
                      placeholder="Google Play 계정 이메일"
                      disabled={testerSubmitting}
                      style={{
                        flex: 1,
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid #d6e0ff',
                        fontSize: 14,
                        minWidth: 0,
                      }}
                    />
                    <button
                      type="submit"
                      disabled={testerSubmitting}
                      style={{
                        flexShrink: 0,
                        background: 'linear-gradient(135deg, #3DDC84, #00b894)',
                        color: '#fff',
                        padding: '0 18px',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 14,
                        border: 'none',
                        cursor: testerSubmitting ? 'default' : 'pointer',
                        opacity: testerSubmitting ? 0.7 : 1,
                      }}
                    >
                      {testerSubmitting ? '접수 중...' : '신청하기'}
                    </button>
                  </div>
                  {testerError && (
                    <div style={{ marginTop: 8, fontSize: 12.5, color: '#c0392b', wordBreak: 'break-all' }}>
                      {testerError}
                    </div>
                  )}
                </form>
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
