import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export const ClubMileageRetroactive = () => {
  const navigate = useNavigate();
  useParams<{ clubId: string }>();

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>소급 재계산</h1>
      </div>
      <div className="container" style={{ paddingTop: 40, textAlign: 'center', color: '#888' }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>🔧</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#555', marginBottom: 8 }}>준비 중</p>
        <p style={{ fontSize: 14 }}>과거 기간 소급 재계산 기능은 곧 추가됩니다.</p>
      </div>
    </div>
  );
};
