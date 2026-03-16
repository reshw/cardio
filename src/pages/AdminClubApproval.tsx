import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import clubService from '../services/clubService';
import type { Club } from '../services/clubService';

export const AdminClubApproval = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pendingClubs, setPendingClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 어드민 권한 확인
    if (!user?.is_admin) {
      alert('접근 권한이 없습니다.');
      navigate('/more');
      return;
    }

    loadPendingClubs();
  }, [user, navigate]);

  const loadPendingClubs = async () => {
    setLoading(true);
    try {
      const clubs = await clubService.getPendingClubs();
      setPendingClubs(clubs);
    } catch (error) {
      console.error('승인 대기 클럽 조회 실패:', error);
      alert('클럽 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (clubId: string, clubName: string) => {
    if (!window.confirm(`"${clubName}" 클럽을 승인하시겠습니까?`)) return;

    try {
      await clubService.approveClub(clubId, user!.id);
      alert('클럽이 승인되었습니다.');
      loadPendingClubs();
    } catch (error) {
      console.error('클럽 승인 실패:', error);
      alert('클럽 승인에 실패했습니다.');
    }
  };

  const handleReject = async (clubId: string, clubName: string) => {
    const reason = prompt(`"${clubName}" 클럽을 거부하는 사유를 입력하세요:`);
    if (!reason) return;

    try {
      await clubService.rejectClub(clubId, reason);
      alert('클럽이 거부되었습니다.');
      loadPendingClubs();
    } catch (error) {
      console.error('클럽 거부 실패:', error);
      alert('클럽 거부에 실패했습니다.');
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
        <button className="back-button" onClick={() => navigate('/admin')}>
          <ChevronLeft size={24} />
        </button>
        <h1>클럽 생성 승인</h1>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2 className="section-title">
            <Clock size={20} />
            승인 대기 클럽 ({pendingClubs.length})
          </h2>

          {pendingClubs.length === 0 ? (
            <div className="empty-state">
              <p>승인 대기 중인 클럽이 없습니다.</p>
            </div>
          ) : (
            <div className="admin-club-list">
              {pendingClubs.map((club: any) => (
                <div key={club.id} className="admin-club-card">
                  <div className="admin-club-header">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt={club.name} className="admin-club-logo" />
                    ) : (
                      <div className="admin-club-logo-placeholder">🏋️</div>
                    )}
                    <div className="admin-club-info">
                      <h3>{club.name}</h3>
                      <p className="admin-club-description">{club.description}</p>
                      <p className="admin-club-meta">
                        생성자: {club.users?.display_name || '알 수 없음'}
                        <br />
                        신청일: {new Date(club.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>

                  <div className="admin-club-actions">
                    <button
                      className="admin-approve-button"
                      onClick={() => handleApprove(club.id, club.name)}
                    >
                      <CheckCircle size={18} />
                      승인
                    </button>
                    <button
                      className="admin-reject-button"
                      onClick={() => handleReject(club.id, club.name)}
                    >
                      <XCircle size={18} />
                      거부
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
