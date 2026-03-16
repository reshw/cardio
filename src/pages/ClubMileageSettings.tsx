import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import clubService from '../services/clubService';
import type { MileageConfig } from '../services/clubService';

// 마일리지 계산 예시 생성 (나눗셈 방식)
const getExplanation = (coefficient: number, unit: string = 'km'): string => {
  if (coefficient === 0) return '마일리지 없음';

  // 나눗셈 방식: coefficient 자체가 "X 단위당 1 마일리지"
  if (unit === 'km') {
    if (coefficient === 1) {
      return '1km당 1 마일리지';
    } else if (coefficient < 1) {
      return `${coefficient.toFixed(2)}km당 1 마일리지`;
    } else {
      return `${coefficient.toFixed(1)}km당 1 마일리지`;
    }
  } else if (unit === 'm') {
    return `${Math.round(coefficient)}m당 1 마일리지`;
  } else if (unit === '층') {
    return `${Math.round(coefficient)}층당 1 마일리지`;
  }

  return '';
};

export const ClubMileageSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [mileageConfig, setMileageConfig] = useState<MileageConfig>(
    clubService.getDefaultMileageConfig()
  );
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId) {
      loadClub();
    }
  }, [clubId]);

  const loadClub = async () => {
    if (!clubId) return;

    setLoading(true);
    try {
      const club = await clubService.getClubById(clubId);
      setMileageConfig(club.mileage_config || clubService.getDefaultMileageConfig());
    } catch (error) {
      console.error('클럽 정보 불러오기 실패:', error);
      alert('클럽 정보를 불러올 수 없습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleMileageChange = (key: keyof MileageConfig, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setMileageConfig({
        ...mileageConfig,
        [key]: numValue,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clubId) return;

    setUpdating(true);

    try {
      await clubService.updateClub(clubId, {
        mileage_config: mileageConfig,
      });

      alert('마일리지 계수가 수정되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('클럽 수정 실패:', error);
      alert('클럽 수정에 실패했습니다.');
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
        <h1>마일리지 계수 설정</h1>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <p className="form-hint" style={{ marginBottom: '20px' }}>
          각 운동별 마일리지 계산 방식을 설정하세요.
        </p>

        <div className="mileage-edit-list">
          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🏃</span>
              <label>달리기 - 트레드밀</label>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={mileageConfig['달리기-트레드밀']}
              onChange={(e) => handleMileageChange('달리기-트레드밀', e.target.value)}
              className="mileage-input"
              placeholder="예: 3 (3km당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['달리기-트레드밀'], 'km')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🏃‍♂️</span>
              <label>달리기 - 러닝</label>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={mileageConfig['달리기-러닝']}
              onChange={(e) => handleMileageChange('달리기-러닝', e.target.value)}
              className="mileage-input"
              placeholder="예: 1 (1km당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['달리기-러닝'], 'km')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🚴</span>
              <label>사이클 - 실외</label>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={mileageConfig['사이클-실외']}
              onChange={(e) => handleMileageChange('사이클-실외', e.target.value)}
              className="mileage-input"
              placeholder="예: 5 (5km당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['사이클-실외'], 'km')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🚴‍♀️</span>
              <label>사이클 - 실내</label>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={mileageConfig['사이클-실내']}
              onChange={(e) => handleMileageChange('사이클-실내', e.target.value)}
              className="mileage-input"
              placeholder="예: 7 (7km당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['사이클-실내'], 'km')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🏊</span>
              <label>수영</label>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={mileageConfig['수영']}
              onChange={(e) => handleMileageChange('수영', e.target.value)}
              className="mileage-input"
              placeholder="예: 200 (200m당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['수영'], 'm')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🪜</span>
              <label>계단</label>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={mileageConfig['계단']}
              onChange={(e) => handleMileageChange('계단', e.target.value)}
              className="mileage-input"
              placeholder="예: 20 (20층당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['계단'], '층')}
            </div>
          </div>
        </div>

        <button type="submit" className="primary-button-full" disabled={updating}>
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </form>
    </div>
  );
};
