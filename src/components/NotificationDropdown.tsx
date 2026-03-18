import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import type { Notification } from '../services/notificationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNotificationCountChange: (count: number) => void;
}

export const NotificationDropdown = ({ isOpen, onClose, onNotificationCountChange }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadNotifications();
    }
  }, [isOpen, user]);

  // 실시간 알림 구독
  useEffect(() => {
    if (!user) return;

    const channel = notificationService.subscribeToNotifications(user.id, (newNotification) => {
      setNotifications((prev) => [newNotification, ...prev]);
      onNotificationCountChange(notifications.length + 1);
    });

    return () => {
      notificationService.unsubscribe(channel);
    };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    console.log('🔔 알림 로드 시작, user.id:', user.id);
    setLoading(true);
    try {
      const data = await notificationService.getMyNotifications(user.id);
      console.log('🔔 알림 데이터:', data);
      setNotifications(data);
      onNotificationCountChange(data.length);
    } catch (error) {
      console.error('❌ 알림 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 알림 읽음 처리 (확인)
  const handleMarkAsRead = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); // 부모 클릭 이벤트 방지
    if (!user) return;

    try {
      await notificationService.markAsRead(notificationId, user.id);

      // UI 업데이트 (읽은 알림은 목록에서 제거)
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      onNotificationCountChange(notifications.length - 1);
    } catch (error) {
      console.error('알림 읽음 처리 실패:', error);
      alert('알림 읽음 처리에 실패했습니다.');
    }
  };

  // 알림 클릭 시 해당 운동으로 이동
  const handleNotificationClick = (notification: Notification) => {
    onClose();

    if (notification.type === 'comment' && notification.comment_id) {
      // 댓글 알림: commentId를 URL 쿼리 파라미터에 포함
      navigate(`/workout/${notification.workout_id}?commentId=${notification.comment_id}`);
    } else {
      // 좋아요 알림: 일반 이동
      navigate(`/workout/${notification.workout_id}`);
    }
  };

  const handleDeleteAll = async () => {
    if (!user || !confirm('모든 알림을 읽음 처리하시겠습니까?')) return;

    try {
      await notificationService.markAllAsRead(user.id);
      setNotifications([]);
      onNotificationCountChange(0);
    } catch (error) {
      console.error('모든 알림 읽음 처리 실패:', error);
      alert('알림 읽음 처리에 실패했습니다.');
    }
  };

  const getNotificationMessage = (notification: Notification) => {
    // 클럽 닉네임 우선, 없으면 실명
    const actorName = notification.actor_club_nickname || notification.actor?.display_name || '알 수 없음';

    // 운동 종류
    const workoutLabel = notification.workout?.sub_type
      ? `${notification.workout.category} - ${notification.workout.sub_type}`
      : notification.workout?.category || '운동';

    // 운동 날짜
    const workoutDate = notification.workout?.created_at
      ? new Date(notification.workout.created_at).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

    if (notification.type === 'like') {
      return `${actorName}님이 ${workoutDate} ${workoutLabel}에 좋아요를 눌렀습니다.`;
    } else {
      const commentPreview = notification.comment_text
        ? `: "${notification.comment_text.substring(0, 30)}${notification.comment_text.length > 30 ? '...' : ''}"`
        : '';
      return `${actorName}님이 ${workoutDate} ${workoutLabel}에 댓글을 남겼습니다${commentPreview}`;
    }
  };

  const formatTime = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return created.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div className="notification-overlay" onClick={onClose} />

      {/* 드롭다운 */}
      <div className={`notification-dropdown ${isOpen ? 'open' : ''}`}>
        {/* 헤더 */}
        <div className="notification-header">
          <h3>알림</h3>
          <div className="notification-header-actions">
            {notifications.length > 0 && (
              <button className="notification-delete-all" onClick={handleDeleteAll}>
                <Check size={16} />
                모두 읽음
              </button>
            )}
            <button className="notification-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 알림 리스트 */}
        <div className="notification-list">
          {loading ? (
            <div className="notification-loading">
              <div className="spinner"></div>
              <p>알림 불러오는 중...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <p>알림이 없습니다.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              // 프로필 이미지 렌더링
              const profileImage = notification.actor?.profile_image;
              const displayName = notification.actor?.display_name || '?';
              const renderAvatar = () => {
                if (profileImage?.startsWith('default:')) {
                  const color = profileImage.replace('default:', '');
                  return (
                    <div
                      className="notification-avatar-placeholder"
                      style={{ background: color, color: 'white' }}
                    >
                      {displayName[0].toUpperCase()}
                    </div>
                  );
                } else if (profileImage) {
                  return <img src={profileImage} alt={displayName} />;
                } else {
                  return (
                    <div
                      className="notification-avatar-placeholder"
                      style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}
                    >
                      {displayName[0]}
                    </div>
                  );
                }
              };

              return (
                <div
                  key={notification.id}
                  className="notification-item"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-avatar">
                    {renderAvatar()}
                  </div>

                  <div className="notification-content">
                    <p className="notification-message">{getNotificationMessage(notification)}</p>
                    <div className="notification-meta">
                      {notification.club_name && (
                        <span className="notification-club">{notification.club_name}</span>
                      )}
                      <span className="notification-time">{formatTime(notification.created_at)}</span>
                    </div>
                  </div>

                  <div className="notification-actions">
                    <div className="notification-indicator">
                      {notification.type === 'like' ? '❤️' : '💬'}
                    </div>
                    <button
                      className="notification-check-btn"
                      onClick={(e) => handleMarkAsRead(e, notification.id)}
                      title="확인"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
