import { useState, useEffect } from 'react';
import { Bell, CirclePlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationDropdown } from './NotificationDropdown';
import notificationService from '../services/notificationService';
import { CreateClubModal } from './CreateClubModal';

export const Header = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showClubActionModal, setShowClubActionModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path.startsWith('/history')) return '기록';
    if (path.startsWith('/club')) return '클럽';
    if (path.startsWith('/join')) return '클럽 가입';
    if (path.startsWith('/more')) return '더보기';
    return 'Cardio';
  };

  // 읽지 않은 알림 개수 조회
  useEffect(() => {
    if (user) {
      loadUnreadCount();
    }
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;
    console.log('🔢 읽지 않은 알림 개수 조회 시작');
    try {
      const count = await notificationService.getUnreadCount(user.id);
      console.log('🔢 읽지 않은 알림 개수:', count);
      setUnreadCount(count);
    } catch (error) {
      console.error('❌ 읽지 않은 알림 개수 조회 실패:', error);
    }
  };

  const handleNotificationToggle = () => {
    console.log('🔔 알림 버튼 클릭, 현재 상태:', isNotificationOpen);
    setIsNotificationOpen(!isNotificationOpen);
  };

  return (
    <>
      <header className="app-header">
        <div className="header-logo">
          <h1>{getPageTitle()}</h1>
        </div>

        {user && (
          <div className="header-notification">
            {location.pathname.startsWith('/club') && !location.pathname.includes('/settings') && !location.pathname.includes('/members') && !location.pathname.includes('/member/') && !location.pathname.includes('/my-settings') && (
              <button
                className="header-action-button"
                onClick={() => setShowClubActionModal(true)}
              >
                <CirclePlus size={22} />
              </button>
            )}
            <button className="notification-button" onClick={handleNotificationToggle}>
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationDropdown
              isOpen={isNotificationOpen}
              onClose={() => setIsNotificationOpen(false)}
              onNotificationCountChange={setUnreadCount}
            />
          </div>
        )}
      </header>

      {/* 클럽 액션 선택 모달 */}
      {showClubActionModal && (
        <div className="modal-overlay" onClick={() => setShowClubActionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>클럽</h2>
              <button className="modal-close" onClick={() => setShowClubActionModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="club-action-buttons">
                <button
                  className="club-action-modal-button"
                  onClick={() => {
                    setShowClubActionModal(false);
                    navigate('/join');
                  }}
                >
                  <span className="action-icon">🔗</span>
                  <div className="action-text">
                    <div className="action-title">코드로 가입</div>
                    <div className="action-desc">초대코드로 클럽 참여하기</div>
                  </div>
                </button>
                {user?.is_admin && (
                  <button
                    className="club-action-modal-button"
                    onClick={() => {
                      setShowClubActionModal(false);
                      setShowCreateModal(true);
                    }}
                  >
                    <span className="action-icon">➕</span>
                    <div className="action-text">
                      <div className="action-title">클럽 만들기 <span style={{ fontSize: '11px', color: '#FF6B6B', fontWeight: '600' }}>🔒 시스템 관리자 전용</span></div>
                      <div className="action-desc">새로운 클럽 생성하기</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 클럽 생성 모달 */}
      {showCreateModal && (
        <CreateClubModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
};
