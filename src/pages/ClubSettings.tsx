import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Info, TrendingUp, UserCog, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';

export const ClubSettings = () => {
  const { clubId, clubName } = useParams<{ clubId: string; clubName: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId && user) {
      checkAdminStatus();
    }
  }, [clubId, user]);

  const checkAdminStatus = async () => {
    if (!clubId || !user) return;

    setLoading(true);
    try {
      const admin = await clubService.isClubAdmin(clubId, user.id);
      setIsAdmin(admin);
    } catch (error) {
      console.error('권한 확인 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!clubId || !user) return;

    const confirmLeave = window.confirm('정말로 이 클럽에서 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!confirmLeave) return;

    try {
      await clubService.leaveClub(clubId, user.id);
      alert('클럽에서 탈퇴되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('클럽 탈퇴 실패:', error);
      alert('클럽 탈퇴에 실패했습니다. 다시 시도해주세요.');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>클럽 설정</h1>
      </div>

      <div className="settings-menu">
        {/* 모든 사용자 공통 설정 */}
        <div className="settings-section">
          <button
            className="settings-menu-item"
            onClick={() => navigate(`/club/my-settings/${clubId}/${encodeURIComponent(clubName || '')}`)}
          >
            <div className="menu-item-left">
              <User size={20} />
              <span>내 별명 변경</span>
            </div>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 클럽 탈퇴 (클럽장 제외) */}
        {!isAdmin && (
          <div className="settings-section danger-section">
            <button
              className="settings-menu-item danger"
              onClick={handleLeaveClub}
            >
              <div className="menu-item-left">
                <User size={20} />
                <span>클럽 탈퇴하기</span>
              </div>
            </button>
          </div>
        )}

        {/* 관리자 전용 설정 */}
        {isAdmin && (
          <>
            <div className="settings-section">
              <button
                className="settings-menu-item"
                onClick={() => navigate(`/club/settings/${clubId}/${encodeURIComponent(clubName || '')}/general`)}
              >
                <div className="menu-item-left">
                  <Info size={20} />
                  <span>클럽 일반정보 변경</span>
                </div>
                <ChevronRight size={20} />
              </button>

              <button
                className="settings-menu-item"
                onClick={() => navigate(`/club/settings/${clubId}/${encodeURIComponent(clubName || '')}/mileage`)}
              >
                <div className="menu-item-left">
                  <TrendingUp size={20} />
                  <span>마일리지 계수 설정</span>
                </div>
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="settings-section danger-section">
              <button
                className="settings-menu-item danger"
                onClick={() => navigate(`/club/settings/${clubId}/${encodeURIComponent(clubName || '')}/transfer`)}
              >
                <div className="menu-item-left">
                  <UserCog size={20} />
                  <span>클럽장 위임</span>
                </div>
                <ChevronRight size={20} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
