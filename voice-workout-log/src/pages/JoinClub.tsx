import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clubService from '../services/clubService';
import type { Club } from '../types';

export const JoinClubPage = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (inviteCode) {
      loadClub();
    }
  }, [inviteCode]);

  const loadClub = async () => {
    if (!inviteCode) return;

    setLoading(true);
    try {
      const clubData = await clubService.getClubByInviteCode(inviteCode);
      if (!clubData) {
        alert('유효하지 않은 초대 링크입니다.');
        navigate('/club');
        return;
      }
      setClub(clubData);
    } catch (error) {
      console.error('클럽 조회 실패:', error);
      alert('클럽을 찾을 수 없습니다.');
      navigate('/club');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!club) return;

    setJoining(true);
    try {
      await clubService.joinClub(club.id);
      alert('클럽에 가입했습니다!');
      navigate(`/club/${club.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '가입에 실패했습니다.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">로딩 중...</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="container">
        <div className="empty-state">
          <p>클럽을 찾을 수 없습니다.</p>
          <button className="primary-button" onClick={() => navigate('/club')}>
            클럽 목록으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate('/club')}>
          ← 뒤로
        </button>
        <h2>클럽 가입</h2>
      </div>

      <div className="section">
        <h3 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '12px' }}>
          {club.name}
        </h3>
        {club.description && (
          <p
            style={{
              fontSize: '15px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
              lineHeight: '1.6',
            }}
          >
            {club.description}
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <div className="stat-chip">{club.is_public ? '🌐 공개' : '🔒 비공개'}</div>
        </div>

        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
          }}
        >
          이 클럽에 가입하시겠습니까?
        </p>

        <div className="action-buttons">
          <button className="cancel-button" onClick={() => navigate('/club')}>
            취소
          </button>
          <button className="primary-button" onClick={handleJoin} disabled={joining}>
            {joining ? '가입 중...' : '가입하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
