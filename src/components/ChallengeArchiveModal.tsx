import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import challengeService from '../services/challengeService';
import type { Challenge } from '../services/challengeService';
import { ChallengeStatsModal } from './ChallengeStatsModal';

interface Props {
  clubId: string;
  clubName: string;
  isManager: boolean;
  onClose: () => void;
}

export const ChallengeArchiveModal = ({ clubId, clubName, isManager, onClose }: Props) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    challengeService.getPastChallengesForClub(clubId)
      .then(setChallenges)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId]);

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>지난 챌린지</h2>
            <button className="modal-close" onClick={onClose}><X size={20} /></button>
          </div>
          <div className="modal-body">
            {loading && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 0' }}>불러오는 중...</p>
            )}
            {!loading && challenges.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 0' }}>지난 챌린지가 없습니다.</p>
            )}
            {challenges.map((c) => {
              const duration = challengeService.getChallengeDuration(c.start_date, c.end_date);
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChallenge(c)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '8px',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--input-bg)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '')}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{c.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {c.start_date.replace(/-/g, '.')} ~ {c.end_date.replace(/-/g, '.')}
                    <span style={{ marginLeft: '6px' }}>({duration}일간)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {selectedChallenge && (
        <ChallengeStatsModal
          challenge={selectedChallenge}
          clubId={clubId}
          clubName={clubName}
          isManager={isManager}
          onClose={() => setSelectedChallenge(null)}
        />
      )}
    </>
  );
};
