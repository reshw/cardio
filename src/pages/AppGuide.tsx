import { ChevronLeft, BookOpen } from 'lucide-react';

export const AppGuide = () => {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => window.history.back()}>
          <ChevronLeft size={24} />
        </button>
        <h1>앱 사용 설명</h1>
      </div>

      <div className="settings-form">
        <div className="guide-section">
          <div className="guide-icon">
            <BookOpen size={32} />
          </div>
          <h2>Cardio Club 사용법</h2>
        </div>

        <div className="guide-content">
          <div className="guide-item">
            <h3>1. 본인 기록을 "기록" 메뉴에서 등록합니다.</h3>
            <div className="guide-subitem">
              <p>1-1. 종목을 선택하고, 데이터와 날짜를 입력, 데이터를 확인할 수 있는 관련 이미지를 첨부하면 좋습니다.</p>
              <p>1-2. 통계실과 캘린더를 통해 본인의 운동 이력을 쌓아나가 보세요.</p>
            </div>
          </div>

          <div className="guide-item">
            <h3>2. 본인 "기록"을 불러와서 "클럽" 형태로 보여줍니다.</h3>
            <div className="guide-subitem">
              <p>2-1. 클럽에서 설정된 운동별 마일리지 계수를 적용하여 "마일리지"를 계산하여 월간 누적치 순위를 볼 수 있습니다.</p>
            </div>
          </div>
        </div>

        <div className="guide-footer">
          <p>더 자세한 사용법은 각 메뉴에서 확인해보세요!</p>
        </div>
      </div>

      <style jsx>{`
        .guide-section {
          text-align: center;
          margin-bottom: 32px;
        }

        .guide-icon {
          color: #4FC3F7;
          margin-bottom: 16px;
        }

        .guide-content {
          margin-bottom: 32px;
        }

        .guide-item {
          margin-bottom: 24px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .guide-item h3 {
          color: #4FC3F7;
          margin-bottom: 12px;
          font-size: 16px;
        }

        .guide-subitem {
          margin-left: 16px;
        }

        .guide-subitem p {
          margin: 8px 0;
          color: #666;
          line-height: 1.5;
        }

        .guide-footer {
          text-align: center;
          color: #888;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};