import { useAuth } from '../contexts/AuthContext';

export const Header = () => {
  const { user } = useAuth();

  return (
    <header className="app-header">
      <div className="header-logo">
        <h1>💪 Cardio</h1>
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
