import { useState, useEffect } from 'react';

/**
 * 진단 전용 페이지 — 4/14 e19dd11 패턴 단독.
 * Samsung Internet kill 원인이 사진 코드인지, 주변 코드(HashRouter·Auth·FCM 등)인지 격리.
 * 결과에 따라:
 *  - 여기서 사진 첨부 OK → 주변 코드 압박이 kill 유발
 *  - 여기서도 kill → OS 수준 한계 (Chrome/PWA/camera capture 외 해결책 없음)
 */
const LOG_KEY = 'test_upload_log';

export default function TestUpload() {
  const [logs, setLogs] = useState<{ t: string; msg: string; color: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
  });
  const [preview, setPreview] = useState<string | null>(null);

  const log = (msg: string, color = '#fff') => {
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
    const onVisibility = () => log(`VISIBILITY → ${document.visibilityState}`, '#ff8');
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    log(`onChange: ${file ? file.name + ' ' + Math.round(file.size / 1024) + 'kb' : 'NULL'}`,
        file ? '#8f8' : '#f44');
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      log(`FileReader done: ${Math.round((reader.result as string).length / 1024)}kb`, '#8f8');
      setPreview(reader.result as string);
    };
    reader.onerror = () => log(`FileReader ERROR: ${reader.error}`, '#f44');
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#fff' }}>
      <h2 style={{ margin: '0 0 12px' }}>📸 사진 첨부 진단 페이지</h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
        4/14 e19dd11 패턴 단독. 라우터·인증·기타 로직 없음.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="test-proof"
          style={{
            display: 'inline-block',
            padding: '12px 20px',
            background: '#4FC3F7',
            color: 'white',
            borderRadius: 12,
            fontWeight: 600,
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => log('label tap', '#ff8')}
        >📷 사진 첨부 (label htmlFor)</label>
        <input
          id="test-proof"
          type="file"
          accept="image/*"
          onChange={onChange}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          id="test-proof-naked"
          type="file"
          accept="image/*"
          onChange={onChange}
        />
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>↑ 완전 native (4월 원본 그대로)</div>
      </div>

      {preview && (
        <div style={{ marginBottom: 20 }}>
          <img src={preview} alt="미리보기"
               style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, border: '1px solid #ddd' }} />
        </div>
      )}

      <div style={{
        background: '#111',
        color: '#fff',
        padding: 10,
        borderRadius: 8,
        fontSize: 11,
        fontFamily: 'monospace',
        maxHeight: 400,
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>🐛 로그</span>
          <button
            type="button"
            onClick={() => { setLogs([]); localStorage.removeItem(LOG_KEY); }}
            style={{ background: '#f44', color: '#fff', border: 'none', borderRadius: 4, padding: '0 8px', fontSize: 11 }}
          >Clear</button>
        </div>
        {logs.length === 0 && <div style={{ color: '#888' }}>이벤트 없음 — 버튼을 눌러보세요</div>}
        {logs.map((l, i) => (
          <div key={i} style={{ color: l.color, padding: '2px 0', borderBottom: '1px solid #222' }}>
            <span style={{ color: '#888' }}>{l.t} </span>{l.msg}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: '#666', marginTop: 16 }}>
        <b>테스트 절차</b><br />
        1. 위 "📷 사진 첨부" 또는 native input 탭<br />
        2. 갤러리에서 사진 선택<br />
        3. 페이지 복귀 후 로그 확인:<br />
        &nbsp;&nbsp;&nbsp;- <code>onChange: filename.jpg ...kb</code> 떴으면 OK<br />
        &nbsp;&nbsp;&nbsp;- MOUNT가 다시 떠 있으면 페이지 kill (Samsung WebView가 죽인 것)<br />
        &nbsp;&nbsp;&nbsp;- 둘 다 없으면 갤러리 자체가 안 열린 것
      </p>
    </div>
  );
}
