import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Header = () => {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      logout();
    }
  };

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-logo">
          <h1>💪 Workout Log</h1>
          
        </div>

        <div className="header-profile" ref={dropdownRef}>
          <button
            className="profile-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="profile-avatar">
              {getInitials(user.display_name || user.username)}
            </div>
            <span className="profile-name">{user.display_name || user.username}</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>

          {isDropdownOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-header">
                <div className="dropdown-user-info">
                  <div className="dropdown-avatar">
                    {getInitials(user.display_name || user.username)}
                  </div>
                  <div className="dropdown-user-details">
                    <div className="dropdown-name">{user.display_name || user.username}</div>
                    {user.email && <div className="dropdown-email">{user.email}</div>}
                  </div>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <button className="dropdown-item" onClick={handleLogout}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
