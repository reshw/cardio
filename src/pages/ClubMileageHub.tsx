import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp, Star, EyeOff, RefreshCw, Clock } from 'lucide-react';
import { useState } from 'react';
import clubService from '../services/clubService';

export const ClubMileageHub = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    if (!clubId) return;
    if (!confirm('이번 달 모든 운동 기록의 마일리지를 현재 계수로 재계산하시겠습니까?')) return;
    setRecalculating(true);
    try {
      const now = new Date();
      await clubService.recalculateClubMonthMileage(clubId, now.getFullYear(), now.getMonth() + 1);
      alert('재계산이 완료되었습니다.');
    } catch {
      alert('재계산에 실패했습니다.');
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>마일리지</h1>
      </div>

      <div className="settings-menu">
        <div className="settings-section">
          <div className="settings-section-title">계수 설정</div>
          <button className="settings-menu-item" onClick={() => navigate(`/club/settings/${clubId}/mileage-config`)}>
            <div className="menu-item-left">
              <TrendingUp size={20} />
              <div>
                <div>마일리지 계수 설정</div>
                <div className="settings-menu-desc">운동별 마일리지 계수 조정</div>
              </div>
            </div>
            <ChevronRight size={20} />
          </button>
          <button className="settings-menu-item" onClick={() => navigate(`/club/settings/${clubId}/rookie-league`)}>
            <div className="menu-item-left">
              <Star size={20} />
              <div>
                <div>리그 제도 운영</div>
                <div className="settings-menu-desc">루키리그 기준 설정</div>
              </div>
            </div>
            <ChevronRight size={20} />
          </button>
          <button className="settings-menu-item" onClick={() => navigate(`/club/settings/${clubId}/mileage-hide`)}>
            <div className="menu-item-left">
              <EyeOff size={20} />
              <div>
                <div>탭 숨김 기간</div>
                <div className="settings-menu-desc">특정 기간 마일리지 탭 숨기기</div>
              </div>
            </div>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">재계산</div>
          <button
            className="settings-menu-item"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            <div className="menu-item-left">
              <RefreshCw size={20} />
              <div>
                <div>이번 달 재계산</div>
                <div className="settings-menu-desc">현재 계수로 이번 달 전체 재계산</div>
              </div>
            </div>
            {recalculating && <span style={{ fontSize: 12, color: '#888' }}>처리 중...</span>}
          </button>
          <button className="settings-menu-item" onClick={() => navigate(`/club/settings/${clubId}/mileage-retroactive`)}>
            <div className="menu-item-left">
              <Clock size={20} />
              <div>
                <div>소급 재계산</div>
                <div className="settings-menu-desc">과거 기간에 현재 계수 소급 적용</div>
              </div>
            </div>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
