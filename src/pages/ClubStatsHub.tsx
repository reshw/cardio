import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BarChart2, TrendingUp } from 'lucide-react';

export const ClubStatsHub = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>통계</h1>
      </div>

      <div className="settings-menu">
        <div className="settings-section">
          <button className="settings-menu-item" onClick={() => navigate(`/club/settings/${clubId}/stats-chart`)}>
            <div className="menu-item-left">
              <BarChart2 size={20} />
              <div>
                <div>클럽 통계</div>
                <div className="settings-menu-desc">월별 마일리지 · 멤버 · 종목 그래프</div>
              </div>
            </div>
            <ChevronRight size={20} />
          </button>
          <button className="settings-menu-item" onClick={() => navigate(`/club/settings/${clubId}/growth`)}>
            <div className="menu-item-left">
              <TrendingUp size={20} />
              <div>
                <div>이달의 성장</div>
                <div className="settings-menu-desc">팀원별 전달 대비 성장 진척률</div>
              </div>
            </div>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
