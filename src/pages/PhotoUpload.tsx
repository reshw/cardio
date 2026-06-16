import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { uploadToR2 } from '../utils/r2Storage';

/**
 * 가벼운 사진 업로드 전용 페이지.
 * AddWorkout이 무거워서 갤러리 launch 시 Android가 메모리 회수로 kill하는 문제 회피.
 * AddWorkout → 여기로 navigate → 사진 선택+R2 업로드 → sessionStorage에 URL 저장 → back.
 */
const PENDING_PHOTO_KEY = 'addworkout_pending_photo_url';
const LOG_KEY = 'photo_upload_log';

export default function PhotoUpload() {
  const navigate = useNavigate();
  const isDebug = window.location.hash.includes('debug=1');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ t: string; msg: string; color: string }[]>(() => {
    if (!isDebug) return [];
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
  });

  const log = (msg: string, color = '#fff') => {
    if (!isDebug) return;
    const t = new Date().toISOString().slice(11, 23);
    setLogs(prev => {
      const next = [...prev.slice(-49), { t, msg, color }];
      try { localStorage.setItem(LOG_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    log(`MOUNT href=${window.location.href.slice(-40)}`, '#88f');
    const onPageHide = (e: PageTransitionEvent) =>
      log(`pagehide persisted=${e.persisted}`, e.persisted ? '#8f8' : '#f44');
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    log(`onChange: ${file ? file.name + ' ' + Math.round(file.size / 1024) + 'kb' : 'NULL'}`,
        file ? '#8f8' : '#f44');
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadToR2(file);
      log(`R2 uploaded: ${url.slice(-40)}`, '#8f8');
      sessionStorage.setItem(PENDING_PHOTO_KEY, url);
      navigate(-1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`R2 FAILED: ${msg}`, '#f44');
      setError(msg);
      setUploading(false);
    }
  };

  return (
    <div className="container">
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>사진 첨부</h1>
      </div>

      <div style={{ padding: '24px 20px', minHeight: 'calc(100vh - 56px)', background: 'var(--bg-color, #fff)' }}>
        {uploading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>업로드 중...</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              갤러리에서 사진을 선택하면 자동으로 업로드되고<br />
              운동 기록 화면으로 돌아갑니다.
            </p>

            <label
              htmlFor="photo-upload-input"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                background: 'var(--gradient-primary, #4FC3F7)',
                color: 'white',
                borderRadius: 16,
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 4px 14px rgba(79, 195, 247, 0.3)',
              }}
            >
              📷 갤러리에서 사진 선택
            </label>
            <input
              id="photo-upload-input"
              type="file"
              accept="image/*"
              onChange={onChange}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />

            {error && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: '#FEE',
                color: '#C00',
                borderRadius: 8,
                fontSize: 13,
              }}>
                업로드 실패: {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: 14,
                background: 'transparent',
                border: '1.5px solid var(--border-color, #ddd)',
                borderRadius: 12,
                fontSize: 14,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              취소
            </button>
          </>
        )}

        {isDebug && (
          <div style={{
            marginTop: 24,
            background: '#111',
            color: '#fff',
            padding: 10,
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'monospace',
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            <div style={{ marginBottom: 6 }}>🐛 로그</div>
            {logs.length === 0 && <div style={{ color: '#888' }}>이벤트 없음</div>}
            {logs.map((l, i) => (
              <div key={i} style={{ color: l.color, padding: '2px 0', borderBottom: '1px solid #222' }}>
                <span style={{ color: '#888' }}>{l.t} </span>{l.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
