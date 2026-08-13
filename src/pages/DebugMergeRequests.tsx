import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import workoutSourceLinkService, { type MergeCandidate } from '../services/workoutSourceLinkService';

const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android' };

const formatDateTime = (dateString: string) => {
  const d = new Date(dateString);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const DebugMergeRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<MergeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.isGuest) {
      setLoading(false);
      return;
    }
    workoutSourceLinkService
      .getMergeCandidates(user.id)
      .then(setCandidates)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>개인 기록 병합신청</h1>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '0 4px 16px' }}>
        여러 기기/앱에서 같은 활동으로 연결된 기록 목록입니다. 지금은 조회만 가능하고,
        소스를 직접 지정해 병합하는 기능은 준비 중입니다.
      </p>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <p>목록을 불러오지 못했습니다: {error}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="empty-state">
          <p>여러 소스가 연결된 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="blocked-users-list">
          {candidates.map((c) => (
            <div key={c.workoutId} className="blocked-user-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="blocked-user-info" style={{ width: '100%' }}>
                <div>
                  <div className="blocked-user-name">
                    {c.category}{c.subType ? ` · ${c.subType}` : ''} — {c.value}{c.unit}
                  </div>
                  <div className="blocked-user-club">{formatDateTime(c.workoutTime)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                {c.sources
                  .slice()
                  .sort((a, b) => b.quality_score - a.quality_score)
                  .map((s, i) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>
                        {i === 0 && <strong style={{ color: 'var(--text-primary)' }}>[현재 채택] </strong>}
                        {PLATFORM_LABEL[s.platform] ?? s.platform}
                        {s.source_name ? ` · ${s.source_name}` : ''}
                      </span>
                      <span>score {s.quality_score} · {formatDateTime(s.linked_at)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
