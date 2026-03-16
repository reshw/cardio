import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import challengeService from '../services/challengeService';
import type { ChallengeDetailWithContributors } from '../types';

export const ChallengeDetailPage = () => {
  const { clubId, challengeId } = useParams<{ clubId: string; challengeId: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ChallengeDetailWithContributors | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (challengeId) {
      loadChallenge();
    }
  }, [challengeId]);

  const loadChallenge = async () => {
    if (!challengeId) return;

    setLoading(true);
    try {
      const data = await challengeService.getChallengeDetail(challengeId);
      setChallenge(data);

      // Auto-update status
      await challengeService.checkAndUpdateChallengeStatus(challengeId);
    } catch (error) {
      console.error('챌린지 조회 실패:', error);
      alert('챌린지를 불러오는데 실패했습니다.');
      navigate(`/club/${clubId}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">로딩 중...</div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="container">
        <div className="empty-state">
          <p>챌린지를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const progress = challengeService.calculateProgress(
    challenge.current_value,
    challenge.target_value
  );

  const getChallengeTypeLabel = (type: string) => {
    switch (type) {
      case 'total_workouts':
        return '총 운동 수';
      case 'total_volume':
        return '총 볼륨 (kg)';
      case 'total_duration':
        return '총 시간 (분)';
      case 'total_distance':
        return '총 거리 (km)';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { text: '진행 중', color: 'var(--primary-color)' };
      case 'completed':
        return { text: '완료', color: '#4CAF50' };
      case 'failed':
        return { text: '실패', color: '#F44336' };
      default:
        return { text: status, color: 'var(--text-secondary)' };
    }
  };

  const statusBadge = getStatusBadge(challenge.status);

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate(`/club/${clubId}`)}>
          ← 뒤로
        </button>
        <h2>챌린지 상세</h2>
      </div>

      {/* Challenge Info */}
      <div className="section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
            {challenge.title}
          </h3>
          <span
            style={{
              fontSize: '12px',
              padding: '4px 12px',
              background: statusBadge.color,
              color: 'white',
              borderRadius: '6px',
              fontWeight: '600',
            }}
          >
            {statusBadge.text}
          </span>
        </div>
        {challenge.description && (
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}
          >
            {challenge.description}
          </p>
        )}
        <div className="log-meta" style={{ marginBottom: '16px' }}>
          <span>{getChallengeTypeLabel(challenge.challenge_type)}</span>
          <span>
            {challenge.start_date} ~ {challenge.end_date}
          </span>
        </div>

        {/* Progress */}
        <div className="progress-bar-container" style={{ marginBottom: '8px' }}>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div
          className="progress-text"
          style={{ fontSize: '18px', fontWeight: '700', textAlign: 'center' }}
        >
          {challenge.current_value} / {challenge.target_value} ({progress}%)
        </div>
      </div>

      {/* Leaderboard */}
      <div className="section">
        <h3>기여 순위 🏆</h3>
        {challenge.contributors.length === 0 ? (
          <p
            style={{
              textAlign: 'center',
              color: 'var(--text-secondary)',
              padding: '20px',
            }}
          >
            아직 기여자가 없습니다.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {challenge.contributors.map((contributor, idx) => (
              <div
                key={contributor.user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  background: idx === 0 ? 'rgba(255, 215, 0, 0.1)' : 'var(--input-bg)',
                  border: `1px solid ${idx === 0 ? 'gold' : 'var(--border-color)'}`,
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    minWidth: '30px',
                  }}
                >
                  {idx === 0 && '🥇'}
                  {idx === 1 && '🥈'}
                  {idx === 2 && '🥉'}
                  {idx > 2 && `${idx + 1}`}
                </div>
                <div
                  className="profile-avatar"
                  style={{ width: '40px', height: '40px', fontSize: '16px' }}
                >
                  {contributor.user.display_name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '600' }}>
                    {contributor.user.display_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    @{contributor.user.username}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: 'var(--primary-color)',
                  }}
                >
                  {contributor.total_contribution.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contribute Button */}
      {challenge.status === 'active' && (
        <button
          className="primary-button"
          onClick={() => {
            // Navigate to History page
            navigate('/', { state: { contributeChallengeId: challengeId } });
          }}
        >
          💪 운동 기록하고 기여하기
        </button>
      )}
    </div>
  );
};
