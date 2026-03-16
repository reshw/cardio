import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

export const Header = () => {
  const { user } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path.startsWith('/history')) return '기록';
    if (path.startsWith('/club')) return '클럽';
    if (path.startsWith('/join')) return '클럽 가입';
    if (path.startsWith('/more')) return '더보기';
    return 'Cardio';
  };

  return (
    <header className="app-header">
      <div className="header-logo">
        <h1>{getPageTitle()}</h1>
      </div>

      {user && (
        <div className="header-profile">
          {user.profile_image ? (
            <img
              src={user.profile_image}
              alt={user.display_name}
              className="profile-image"
            />
          ) : (
            <div className="profile-placeholder">
              {user.display_name?.[0] || '👤'}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
