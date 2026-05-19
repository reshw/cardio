import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, BookOpen, Smartphone, UserX, Image, MessageSquarePlus } from 'lucide-react';
import { InstallGuideModal } from '../components/InstallGuideModal';
import { FeedbackModal } from '../components/FeedbackModal';

const KAKAO_SHARE_KEY = 'kakao_share_auto_popup';

export const More = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [kakaoShareOn, setKakaoShareOn] = useState(
    () => localStorage.getItem(KAKAO_SHARE_KEY) !== 'false'
  );

  const toggleKakaoShare = () => {
    const next = !kakaoShareOn;
    setKakaoShareOn(next);
    localStorage.setItem(KAKAO_SHARE_KEY, next ? 'true' : 'false');
  };

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
          {user?.is_super_admin && (
            <button
              className="admin-menu-button"
              onClick={() => navigate('/admin/image-settings')}
              style={{ marginTop: '12px' }}
            >
              <Image size={20} />
              <span>이미지 업로드 설정</span>
            </button>
          )}
        </div>
      )}

      <div className="section">
        <h3>앱 설정</h3>
        <div className="menu-list">
          <div className="menu-item-btn" style={{ cursor: 'default' }}>
            <div className="menu-item-left">
              <span style={{ fontSize: 20 }}>💬</span>
              <span>운동 후 카톡 공유 창 자동 표시</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={kakaoShareOn} onChange={toggleKakaoShare} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>멤버 관리</h3>
        <div className="menu-list">
          <button
            className="menu-item-btn"
            onClick={() => navigate('/blocked-members')}
          >
            <div className="menu-item-left">
              <UserX size={20} />
              <span>차단한 멤버 관리</span>
            </div>
          </button>
        </div>
      </div>

      <div className="section">
        <h3>앱 정보</h3>
        <div className="menu-list">
          <button
            className="menu-item-btn"
            onClick={() => navigate('/guide')}
          >
            <div className="menu-item-left">
              <BookOpen size={20} />
              <span>사용 설명</span>
            </div>
          </button>
          <button
            className="menu-item-btn"
            onClick={() => setShowInstallGuide(true)}
          >
            <div className="menu-item-left">
              <Smartphone size={20} />
              <span>앱 설치 안내</span>
            </div>
          </button>
          <button
            className="menu-item-btn"
            onClick={() => setShowFeedback(true)}
          >
            <div className="menu-item-left">
              <MessageSquarePlus size={20} />
              <span>수정 요청 / 버그 제보</span>
            </div>
          </button>
        </div>
      </div>

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

      {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
};
