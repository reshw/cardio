import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield } from 'lucide-react';

export const More = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container">
      <div className="header">
        <h1>더보기</h1>
      </div>

      {user?.is_admin && (
        <div className="section">
          <h3>관리자 메뉴</h3>
          <button
            className="admin-menu-button"
            onClick={() => navigate('/admin')}
          >
            <Shield size={20} />
            <span>어드민 관리</span>
          </button>
        </div>
      )}

      <div className="section">
        <h3>사용자 정보</h3>
        <p><strong>이름:</strong> {user?.display_name}</p>
        <p><strong>이메일:</strong> {user?.email || '없음'}</p>
        {user?.profile_image && (
          <div style={{ marginTop: '16px' }}>
            <img
              src={user.profile_image}
              alt="프로필"
              style={{ width: '80px', height: '80px', borderRadius: '50%' }}
            />
          </div>
        )}
      </div>

      <button className="primary-button" onClick={logout}>
        로그아웃
      </button>
    </div>
  );
};
