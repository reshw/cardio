import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import feedService from '../services/feedService';
import type { LikesByClub } from '../services/feedService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workoutId: string;
}

export const LikeStatsModal = ({ isOpen, onClose, workoutId }: Props) => {
  const [likesByClub, setLikesByClub] = useState<LikesByClub[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLikeStats();
    }
  }, [isOpen, workoutId]);

  const loadLikeStats = async () => {
    setLoading(true);
    try {
      const data = await feedService.getLikesByClub(workoutId);
      setLikesByClub(data);
    } catch (error) {
      console.error('좋아요 통계 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalCount = likesByClub.reduce((sum, club) => sum + club.count, 0);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content like-stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>좋아요 상세</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>로딩 중...</p>
            </div>
          ) : (
            <>
              <p className="total-likes">총 {totalCount}개의 좋아요</p>
              {likesByClub.length === 0 ? (
                <div className="empty-state">아직 좋아요가 없습니다.</div>
              ) : (
                <div className="like-stat-list">
                  {likesByClub.map((club) => (
                    <div key={club.clubId} className="like-stat-item">
                      {club.clubLogo ? (
                        <img src={club.clubLogo} alt={club.clubName} className="club-logo-small" />
                      ) : (
                        <div className="club-logo-placeholder">{club.clubName[0]}</div>
                      )}
                      <span className="club-name">{club.clubName}</span>
                      <span className="like-count">{club.count}개</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
