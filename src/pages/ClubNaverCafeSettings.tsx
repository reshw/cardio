import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useClubName } from '../hooks/useClubName';
import naverCafeService, { type NaverCafeStatus } from '../services/naverCafeService';

// 네이버 카페 자동 발행 설정 (클럽장/부클럽장 전용)
// 1) 네이버 로그인으로 글 쓸 계정 연동  2) 올릴 게시판 주소  3) 자동 발행 on/off

export const ClubNaverCafeSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<NaverCafeStatus>({ connected: false });
  const [boardUrl, setBoardUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const result = searchParams.get('naver');
    if (result === 'connected') setMessage({ type: 'ok', text: '네이버 계정이 연동됐습니다.' });
    if (result === 'error') setMessage({ type: 'error', text: `연동 실패: ${searchParams.get('reason') || '원인 미상'}` });
    if (result) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clubId) return;
    (async () => {
      setLoading(true);
      try {
        const s = await naverCafeService.getStatus(clubId);
        setStatus(s);
        setBoardUrl(s.boardUrl ?? '');
      } catch (err: any) {
        console.error('[네이버카페 설정] 상태 조회 실패:', JSON.stringify(err), err);
        setMessage({ type: 'error', text: `연동 상태 조회 실패: ${err?.message || JSON.stringify(err)}` });
      } finally {
        setLoading(false);
      }
    })();
  }, [clubId]);

  const run = async (fn: () => Promise<NaverCafeStatus | void>, okText?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const s = await fn();
      if (s) { setStatus(s); setBoardUrl(s.boardUrl ?? ''); }
      if (okText) setMessage({ type: 'ok', text: okText });
    } catch (err: any) {
      console.error('[네이버카페 설정] 실패:', JSON.stringify(err), err);
      setMessage({ type: 'error', text: err?.message || JSON.stringify(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!clubId) return null;

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  const boardReady = !!(status.cafeId && status.menuId);
  const outlineBtn: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: '12px', background: 'none',
    border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer',
  };

  const consentNotice = (
    <div style={{
      padding: '12px 14px', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', lineHeight: 1.55,
      background: 'var(--warning-tint)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
    }}>
      ⚠️ 네이버 동의 화면에서 <b>[선택] 카페가입, 글쓰기</b> 를 반드시 체크하세요 (또는 &lsquo;전체 동의하기&rsquo;).
      체크하지 않으면 연동은 되지만 카페에 글이 올라가지 않습니다.
    </div>
  );

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>네이버 카페 연동</h1>
        </div>
      </div>

      <div className="settings-form">
        <p className="form-hint" style={{ marginBottom: '16px' }}>
          클럽달력에 행사를 등록하면 같은 내용으로 네이버 카페 게시판에 글이 자동으로 올라갑니다.
        </p>

        {message && (
          <p style={{
            fontSize: '13px', marginBottom: '16px', lineHeight: 1.5, wordBreak: 'break-all',
            color: message.type === 'ok' ? '#22c55e' : '#ef4444',
          }}>
            {message.text}
          </p>
        )}

        <div className="settings-section">
          <h3>1. 글 쓸 네이버 계정</h3>
          {status.connected ? (
            <>
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                ✅ 연동됨{status.connectedByName ? ` — ${status.connectedByName} 님이 연동` : ''}
                {status.connectedAt ? ` (${new Date(status.connectedAt).toLocaleDateString('ko-KR')})` : ''}
              </p>
              <p className="form-hint" style={{ marginBottom: '12px' }}>
                카페 글은 연동한 네이버 계정 이름으로 올라갑니다. 그 계정이 게시판에 글쓰기 권한이 있어야 해요.
              </p>
              {consentNotice}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" style={outlineBtn} disabled={busy}
                  onClick={() => run(() => naverCafeService.startConnect(clubId))}>
                  다시 연동 (권한 다시 동의)
                </button>
                <button type="button" style={outlineBtn} disabled={busy}
                  onClick={() => { if (confirm('네이버 카페 연동을 해제할까요? 이후 행사는 카페에 올라가지 않습니다.')) run(() => naverCafeService.disconnect(clubId), '연동을 해제했습니다.'); }}>
                  연동 해제
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="form-hint" style={{ marginBottom: '12px' }}>
                카페에 글을 올릴 네이버 계정으로 로그인해주세요. (클럽장 계정 권장)
              </p>
              {consentNotice}
              <button type="button" className="primary-button-full" disabled={busy}
                onClick={() => run(() => naverCafeService.startConnect(clubId))}>
                {busy ? '이동 중...' : '네이버 로그인으로 연동하기'}
              </button>
            </>
          )}
        </div>

        <div className="settings-section">
          <h3>2. 올릴 게시판</h3>
          <p className="form-hint" style={{ marginBottom: '10px' }}>
            PC에서 카페 게시판을 열고 주소창의 주소를 그대로 붙여넣어주세요.
          </p>
          <input
            className="search-input"
            placeholder="https://cafe.naver.com/f-e/cafes/31581338/menus/1"
            value={boardUrl}
            onChange={(e) => setBoardUrl(e.target.value)}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          {boardReady && (
            <p className="form-hint" style={{ marginBottom: '8px' }}>
              카페ID {status.cafeId} · 게시판ID {status.menuId}
            </p>
          )}
          <button type="button" style={outlineBtn} disabled={busy || !boardUrl.trim()}
            onClick={() => run(() => naverCafeService.saveSettings(clubId, { boardUrl }), '게시판을 저장했습니다.')}>
            게시판 저장
          </button>
        </div>

        <div className="settings-section">
          <h3>3. 자동 발행</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={status.autoPublish ?? true}
              disabled={busy}
              onChange={(e) => run(() => naverCafeService.saveSettings(clubId, { autoPublish: e.target.checked }))}
            />
            행사 등록 시 카페에 자동으로 글 올리기
          </label>
          <p className="form-hint" style={{ marginTop: '8px' }}>
            {status.connected && boardReady && (status.autoPublish ?? true)
              ? '지금 설정대로면 새 행사가 카페에 자동으로 올라갑니다. 행사 수정·삭제는 카페 글에 반영되지 않아요.'
              : '계정 연동과 게시판 저장이 모두 끝나야 자동 발행이 동작합니다.'}
          </p>
        </div>
      </div>
    </div>
  );
};
