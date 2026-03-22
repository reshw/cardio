import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';

interface BlockedUser {
  id: string;
  blocked_id: string;
  club_id: string;
  club_name: string;
  club_nickname: string;
  club_profile_image?: string;
  created_at: string;
}

export const BlockedMembers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadBlockedUsers();
  }, [user]);

  const loadBlockedUsers = async () => {
    if (!user) return;
    try {
      const data = await feedService.getMyBlockedUsers(user.id);
      setBlockedUsers(data);
    } catch {
      alert('목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId: string, clubId: string, nickname: string) => {
    if (!user) return;
    if (!confirm(`${nickname}님의 차단을 해제하시겠어요?`)) return;

    const key = `${blockedId}_${clubId}`;
    setUnblocking(key);
    try {
      await feedService.unblockUser(user.id, blockedId, clubId);
      setBlockedUsers(prev => prev.filter(u => !(u.blocked_id === blockedId && u.club_id === clubId)));
    } catch {
      alert('차단 해제에 실패했습니다.');
    } finally {
      setUnblocking(null);
    }
  };

  const renderAvatar = (profileImage: string | undefined, nickname: string) => {
    if (profileImage?.startsWith('default:')) {
      const color = profileImage.replace('default:', '');
      return (
        <div className="blocked-user-avatar" style={{ background: color, color: 'white' }}>
          {nickname[0].toUpperCase()}
        </div>
      );
    } else if (profileImage) {
      return <img src={profileImage} alt={nickname} className="blocked-user-avatar" />;
    }
    return (
      <div className="blocked-user-avatar" style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}>
        {nickname[0]}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
  };

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>차단한 멤버 관리</h1>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      ) : blockedUsers.length === 0 ? (
        <div className="empty-state">
          <p>차단한 멤버가 없습니다.</p>
        </div>
      ) : (
        <div className="blocked-users-list">
          {blockedUsers.map(u => (
            <div key={u.id} className="blocked-user-item">
              <div className="blocked-user-info">
                {renderAvatar(u.club_profile_image, u.club_nickname)}
                <div>
                  <div className="blocked-user-name">{u.club_nickname}</div>
                  <div className="blocked-user-club">{u.club_name}</div>
                  <div className="blocked-user-date">{formatDate(u.created_at)} 차단</div>
                </div>
              </div>
              <button
                className="unblock-btn"
                onClick={() => handleUnblock(u.blocked_id, u.club_id, u.club_nickname)}
                disabled={unblocking === `${u.blocked_id}_${u.club_id}`}
              >
                {unblocking === `${u.blocked_id}_${u.club_id}` ? '처리 중...' : '차단 해제'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
