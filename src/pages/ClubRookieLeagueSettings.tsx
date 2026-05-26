import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import clubService from '../services/clubService';

export const ClubRookieLeagueSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [enabled, setEnabled] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId) loadClub();
  }, [clubId]);

  const loadClub = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const club = await clubService.getClubById(clubId);
      setEnabled(club.rookie_league_enabled !== false);
    } catch {
      alert('클럽 정보를 불러올 수 없습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clubId) return;
    setUpdating(true);
    try {
      await clubService.updateRookieLeagueEnabled(clubId, enabled);
      alert(`루키리그가 ${enabled ? '활성화' : '비활성화'}되었습니다.`);
      navigate(-1);
    } catch {
      alert('설정 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUpdating(false);
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
        <h1>루키리그 설정</h1>
      </div>

      <div className="settings-form">
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>루키리그 활성화</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                한 번도 월 100점을 달성하지 못한 멤버에게<br />
                루키 배지를 표시하고 별도 필터를 제공합니다.
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        <button
          className="primary-button-full"
          onClick={handleSave}
          disabled={updating}
          style={{ marginTop: '24px' }}
        >
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
};
