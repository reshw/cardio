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
  } else if (unit === '분') {
    return `${coefficient.toFixed(2)}분당 1 마일리지`;
  }

  return '';
};

export const ClubMileageSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [mileageConfig, setMileageConfig] = useState<MileageConfig>(
    clubService.getDefaultMileageConfig()
  );
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
      setEnabledCategories(club.enabled_categories || clubService.getAllCategories());
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

    // 최소 1개 이상의 카테고리 선택 검증
    if (enabledCategories.length === 0) {
      alert('최소 1개 이상의 운동 종류를 활성화해야 합니다.');
      return;
    }

    // 확인 모달 표시
    setShowConfirmModal(true);
  };

  const handleConfirmUpdate = async () => {
    if (!clubId) return;

    setShowConfirmModal(false);
    setUpdating(true);

    try {
      // 1. 클럽 설정 업데이트
      await clubService.updateClub(clubId, {
        mileage_config: mileageConfig,
        enabled_categories: enabledCategories,
      });

      // 2. 현재 월의 모든 운동 기록 마일리지 재계산
      await clubService.recalculateCurrentMonthMileage(clubId, mileageConfig);

      alert(
        `마일리지 설정이 수정되었습니다.\n\n` +
        `✅ 활성화된 운동 종류: ${enabledCategories.length}개\n` +
        `✅ 이번 달 기록이 새로운 계수로 재계산되었습니다.`
      );
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
        <div className="settings-section">
          <h3>활성화된 운동 종류</h3>
          <p className="form-hint">
            클럽 랭킹에 포함할 운동 종류를 선택하세요. 비활성화된 운동은 개인 기록에는 남지만 클럽 순위에는 반영되지 않습니다.
          </p>

          <div className="category-checkboxes">
            {Object.entries({
              '달리기-트레드밀': '🏃 달리기 - 트레드밀',
              '달리기-러닝': '🏃‍♂️ 달리기 - 러닝',
              '사이클-실외': '🚴 사이클 - 실외',
              '사이클-실내': '🚴‍♀️ 사이클 - 실내',
              '수영': '🏊 수영',
              '계단': '🪜 계단',
              '복싱-샌드백/미트': '🥊 복싱 - 샌드백/미트',
              '복싱-스파링': '🥊 복싱 - 스파링',
              '요가-일반': '🧘 요가 - 일반',
              '요가-빈야사/아쉬탕가': '🧘‍♀️ 요가 - 빈야사/아쉬탕가',
            }).map(([key, label]) => (
              <label key={key} className="category-checkbox-item">
                <input
                  type="checkbox"
                  checked={enabledCategories.includes(key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setEnabledCategories([...enabledCategories, key]);
                    } else {
                      setEnabledCategories(enabledCategories.filter((k) => k !== key));
                    }
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="settings-section" style={{ marginTop: '32px' }}>
          <h3>마일리지 계수 설정</h3>
          <p className="form-hint" style={{ marginBottom: '20px' }}>
            각 운동별 마일리지 계산 방식을 설정하세요.
          </p>
        </div>

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

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🥊</span>
              <label>복싱 - 샌드백/미트</label>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={mileageConfig['복싱-샌드백/미트']}
              onChange={(e) => handleMileageChange('복싱-샌드백/미트', e.target.value)}
              className="mileage-input"
              placeholder="예: 1.78 (1.78분당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['복싱-샌드백/미트'], '분')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🥊</span>
              <label>복싱 - 스파링</label>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={mileageConfig['복싱-스파링']}
              onChange={(e) => handleMileageChange('복싱-스파링', e.target.value)}
              className="mileage-input"
              placeholder="예: 0.77 (0.77분당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['복싱-스파링'], '분')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🧘</span>
              <label>요가 - 일반</label>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={mileageConfig['요가-일반']}
              onChange={(e) => handleMileageChange('요가-일반', e.target.value)}
              className="mileage-input"
              placeholder="예: 3.27 (3.27분당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['요가-일반'], '분')}
            </div>
          </div>

          <div className="mileage-edit-item">
            <div className="mileage-edit-header">
              <span className="mileage-edit-emoji">🧘</span>
              <label>요가 - 빈야사/아쉬탕가</label>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={mileageConfig['요가-빈야사/아쉬탕가']}
              onChange={(e) => handleMileageChange('요가-빈야사/아쉬탕가', e.target.value)}
              className="mileage-input"
              placeholder="예: 2.45 (2.45분당 1 마일리지)"
            />
            <div className="mileage-edit-preview">
              {getExplanation(mileageConfig['요가-빈야사/아쉬탕가'], '분')}
            </div>
          </div>
        </div>

        <button type="submit" className="primary-button-full" disabled={updating}>
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </form>

      {/* 확인 모달 */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>마일리지 계수 변경</h2>
              <button className="modal-close" onClick={() => setShowConfirmModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>
                마일리지 계수를 변경하면 <strong>이번 달({new Date().getFullYear()}년 {new Date().getMonth() + 1}월)</strong>의
                모든 운동 기록이 새로운 계수로 소급 적용됩니다.
              </p>
              <p style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                💡 과거 월의 기록은 변경되지 않으며, 당시의 마일리지 계수가 유지됩니다.
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                📋 활성화된 운동 종류: <strong>{enabledCategories.length}개</strong> 선택됨<br />
                비활성화된 운동은 개인 기록에 남지만 클럽 랭킹에서 제외됩니다.
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowConfirmModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleConfirmUpdate}
                disabled={updating}
              >
                {updating ? '적용 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
