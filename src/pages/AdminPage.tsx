import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Shield, CheckCircle, ChevronRight, Users, Activity } from 'lucide-react';

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

  // 일반 어드민 메뉴
  const adminMenuItems = [
    {
      icon: <CheckCircle size={24} />,
      title: '클럽 생성 승인',
      description: '신규 클럽 생성 요청을 승인하거나 거부합니다',
      path: '/admin/club-approval',
    },
    {
      icon: <Activity size={24} />,
      title: '운동 종목 관리',
      description: '운동 목록 추가/수정/삭제, 순서 변경',
      path: '/admin/workout-types',
    },
  ];

  // 슈퍼어드민 전용 메뉴
  const superAdminMenuItems = [
    {
      icon: <Users size={24} />,
      title: '회원 관리',
      description: '회원 목록 조회, 강제 탈퇴, 어드민 지정',
      path: '/admin/users',
    },
  ];

  const menuItems = user?.is_super_admin
    ? [...adminMenuItems, ...superAdminMenuItems]
    : adminMenuItems;

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
