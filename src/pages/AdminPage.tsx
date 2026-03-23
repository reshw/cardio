import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Shield, CheckCircle, ChevronRight, Users } from 'lucide-react';

export const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // 어드민 권한 확인
    if (!user?.is_admin) {
      alert('접근 권한이 없습니다.');
      navigate('/more');
      return;
    }
  }, [user, navigate]);

  const menuItems = [
    {
      icon: <CheckCircle size={24} />,
      title: '클럽 생성 승인',
      description: '신규 클럽 생성 요청을 승인하거나 거부합니다',
      path: '/admin/club-approval',
    },
    {
      icon: <Users size={24} />,
      title: '회원 관리',
      description: '회원 목록 조회, 강제 탈퇴, 부어드민 지정',
      path: '/admin/users',
    },
    // 추가 메뉴는 여기에 추가
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate('/more')}>
          <ChevronLeft size={24} />
        </button>
        <h1>
          <Shield size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          어드민 관리
        </h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className="admin-menu-item"
              onClick={() => navigate(item.path)}
            >
              <div className="admin-menu-icon">{item.icon}</div>
              <div className="admin-menu-text">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <ChevronRight size={20} className="admin-menu-arrow" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
