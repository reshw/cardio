import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, RefreshCw, Unlink, User, Download } from 'lucide-react';

interface StravaIntegration {
  id: string;
  user_id: string;
  provider_user_id: string;
  access_token: string;
  token_expires_at: string;
  athlete_name: string | null;
  athlete_profile: string | null;
  created_at: string;
  users: {
    display_name: string;
    profile_image: string | null;
  };
}

interface BackfillResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  activities: { id: number; name: string; type: string; date: string; status: string }[];
}

export const AdminStravaIntegrations = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [integrations, setIntegrations] = useState<StravaIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);

  // Backfill state (상단 독립 섹션)
  const [syncUserId, setSyncUserId] = useState('');
  const [syncAfter, setSyncAfter] = useState('2026-06-01');
  const [syncBefore, setSyncBefore] = useState('2026-06-08');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<BackfillResult | null>(null);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    if (!currentUser?.is_super_admin) {
      alert('슈퍼어드민만 접근할 수 있습니다.');
      navigate('/admin');
      return;
    }
    loadIntegrations();
  }, [currentUser, navigate]);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setListError(false);
    try {
      const res = await fetch(`/api/admin/strava-integrations?caller_id=${currentUser!.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntegrations(data.integrations ?? []);
    } catch {
      setListError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // 리스트가 로드됐을 때 첫 번째 항목을 기본 선택
  useEffect(() => {
    if (integrations.length > 0 && !syncUserId) {
      setSyncUserId(integrations[0].user_id);
    }
  }, [integrations]);

  const handleRevoke = async (userId: string) => {
    setRevoking(userId);
    try {
      const res = await fetch(
        `/api/admin/strava-integrations?caller_id=${currentUser!.id}&user_id=${userId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntegrations((prev) => prev.filter((i) => i.user_id !== userId));
      setConfirmUserId(null);
    } catch {
      alert('Revoke에 실패했습니다.');
    } finally {
      setRevoking(null);
    }
  };

  const handleBackfill = async () => {
    if (!syncUserId.trim()) { setSyncError('유저를 선택하거나 user_id를 입력하세요.'); return; }
    setSyncing(true);
    setSyncResult(null);
    setSyncError('');
    try {
      const res = await fetch('/api/admin/strava-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: currentUser!.id,
          user_id: syncUserId.trim(),
          after_kst: syncAfter,
          before_kst: syncBefore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult(data);
    } catch (err: any) {
      setSyncError(err.message || '동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) <= new Date();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const confirmTarget = integrations.find((i) => i.user_id === confirmUserId);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          <ChevronLeft size={24} />
        </button>
        <h1>Strava 연동 관리</h1>
        <button
          onClick={loadIntegrations}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          title="새로고침"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="settings-content">

        {/* ── 기간 동기화 섹션 (리스트와 독립적으로 동작) ── */}
        <div className="settings-section" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={18} color="#FC4C02" />
            기간 동기화
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            연동 회원의 Strava 기록을 지정 기간만큼 가져옵니다 (KST 기준).
          </p>

          {/* 유저 선택 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              회원 선택
            </label>
            {integrations.length > 0 ? (
              <select
                value={syncUserId}
                onChange={(e) => setSyncUserId(e.target.value)}
                disabled={syncing}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: 14,
                }}
              >
                {integrations.map((i) => (
                  <option key={i.user_id} value={i.user_id}>
                    {i.users.display_name}
                    {i.athlete_name && i.athlete_name !== i.users.display_name ? ` (${i.athlete_name})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="user_id (UUID) 직접 입력"
                value={syncUserId}
                onChange={(e) => setSyncUserId(e.target.value)}
                disabled={syncing}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* 날짜 범위 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>시작일</label>
              <input
                type="date"
                value={syncAfter}
                onChange={(e) => setSyncAfter(e.target.value)}
                disabled={syncing}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: 14,
                }}
              />
            </div>
            <span style={{ paddingTop: 18, color: 'var(--text-secondary)' }}>~</span>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>종료일</label>
              <input
                type="date"
                value={syncBefore}
                onChange={(e) => setSyncBefore(e.target.value)}
                disabled={syncing}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: 14,
                }}
              />
            </div>
          </div>

          <button
            onClick={handleBackfill}
            disabled={syncing}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: syncing ? '#9ca3af' : '#FC4C02', color: '#fff',
              fontWeight: 600, fontSize: 15, cursor: syncing ? 'not-allowed' : 'pointer',
            }}
          >
            {syncing ? '동기화 중...' : '기간 동기화 시작'}
          </button>

          {syncError && (
            <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{syncError}</p>
          )}

          {/* 결과 */}
          {syncResult && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                ✅ {syncResult.imported}개 가져옴 / {syncResult.skipped}개 스킵
                {syncResult.failed > 0 && ` / ${syncResult.failed}개 실패`}
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  (Strava 활동 총 {syncResult.total}개)
                </span>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {syncResult.activities.map((a) => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                      {a.name} <span style={{ color: 'var(--text-tertiary)' }}>({a.type})</span>
                    </span>
                    <span style={{
                      color: a.status === 'imported' ? '#16a34a' : a.status === 'failed' ? '#dc2626' : '#9ca3af',
                      fontWeight: 500, flexShrink: 0, marginLeft: 8,
                    }}>
                      {a.status === 'imported' ? '가져옴'
                        : a.status === 'failed' ? '실패'
                        : a.status.startsWith('skipped(already') ? '이미있음'
                        : '스킵'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 연동 목록 ── */}
        <div className="settings-section">
          <h2 style={{ marginBottom: 12 }}>연동 목록</h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>불러오는 중...</p>
            </div>
          ) : listError ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                목록을 불러오지 못했습니다. (로컬 환경에서는 배포 후 확인 가능)
              </p>
              <button className="btn-secondary" onClick={loadIntegrations} style={{ fontSize: 13 }}>
                재시도
              </button>
            </div>
          ) : integrations.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
              Strava 연동 회원이 없습니다.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-label">연동 회원</div>
                  <div className="stat-value">{integrations.length}명</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="stat-label">토큰 만료</div>
                  <div className="stat-value" style={{ color: '#ef4444' }}>
                    {integrations.filter((i) => isExpired(i.token_expires_at)).length}명
                  </div>
                </div>
              </div>

              <div className="user-list">
                {integrations.map((item) => {
                  const expired = isExpired(item.token_expires_at);
                  const profileImg = item.athlete_profile || item.users.profile_image;
                  return (
                    <div key={item.id} className="user-item" style={{ alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
                        flexShrink: 0, background: '#e5e7eb', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {profileImg
                          ? <img src={profileImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <User size={22} color="#9ca3af" />
                        }
                      </div>

                      <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="user-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {item.users.display_name}
                          {item.athlete_name && item.athlete_name !== item.users.display_name && (
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({item.athlete_name})</span>
                          )}
                          <span style={{
                            fontSize: 11, padding: '2px 6px', borderRadius: 4,
                            background: expired ? '#fee2e2' : '#dcfce7',
                            color: expired ? '#dc2626' : '#16a34a', fontWeight: 600,
                          }}>
                            {expired ? '만료' : '유효'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          토큰 만료: {formatDate(item.token_expires_at)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {/* 이 유저로 동기화 섹션 채우기 */}
                        <button
                          className="btn-icon"
                          onClick={() => { setSyncUserId(item.user_id); setSyncResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          title="기간 동기화"
                          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, color: '#FC4C02', border: '1px solid #FC4C02', background: 'transparent' }}
                        >
                          동기화
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => setConfirmUserId(item.user_id)}
                          title="Strava 연동 강제 해제"
                          disabled={revoking === item.user_id}
                        >
                          <Unlink size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Revoke 확인 모달 */}
      {confirmTarget && (
        <div className="modal-overlay" onClick={() => setConfirmUserId(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Strava 연동 강제 해제</h2>
              <button className="modal-close" onClick={() => setConfirmUserId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
                <strong>{confirmTarget.users.display_name}</strong>님의 Strava 연동을 강제 해제하시겠습니까?
              </p>
              <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
                <strong>⚠️ 주의사항</strong>
                <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                  <li>DB에서 연동 정보가 삭제됩니다</li>
                  <li>Strava OAuth 토큰이 완전히 무효화됩니다</li>
                  <li>이후 Strava 활동이 자동 기록되지 않습니다</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmUserId(null)} disabled={!!revoking}>
                  취소
                </button>
                <button className="btn-danger" style={{ flex: 1 }} onClick={() => handleRevoke(confirmTarget.user_id)} disabled={!!revoking}>
                  {revoking === confirmTarget.user_id ? '해제 중...' : '강제 해제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
