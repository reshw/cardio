import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { NotificationDropdown } from './NotificationDropdown';
import notificationService from '../services/notificationService';

export const Header = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    <header className="app-header">
      <div className="header-logo">
        <h1>{getPageTitle()}</h1>
      </div>

      {user && (
        <div className="header-notification">
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
  );
};
