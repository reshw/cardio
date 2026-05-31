import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import clubService from '../services/clubService';
import workoutTypeService from '../services/workoutTypeService';
import type { MileageConfig } from '../services/clubService';
import type { WorkoutType } from '../services/workoutTypeService';

// 운동 종목을 마일리지 설정 카테고리로 변환
interface WorkoutCategory {
  key: string;
  label: string;
  emoji: string;
  unit: string;
  is_core: boolean;
}

const getWorkoutCategories = (workoutTypes: WorkoutType[]): WorkoutCategory[] => {
  const categories: WorkoutCategory[] = [];

  for (const type of workoutTypes) {
    if (type.sub_types && type.sub_types.length > 0) {
      // 세부타입이 있는 경우
      for (const subType of type.sub_types) {
        categories.push({
          key: `${type.name}-${subType.name}`,
          label: `${type.name} - ${subType.name}`,
          emoji: type.emoji,
          unit: subType.unit, // 서브타입의 unit 사용
          is_core: type.is_core || false,
        });
      }
    } else {
      // 세부타입이 없는 경우
      categories.push({
        key: type.name,
        label: type.name,
        emoji: type.emoji,
        unit: type.unit,
        is_core: type.is_core || false,
      });
    }
  }

  return categories;
};

// 마일리지 계산 예시 생성 (나눗셈 방식)
const getExplanation = (coefficient: number, unit: string = 'km'): string => {
  // undefined 또는 null 체크
  if (coefficient == null || isNaN(coefficient)) return '설정 필요';
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

  const [mileageConfig, setMileageConfig] = useState<MileageConfig>({});
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 동적 운동 종목
  const [workoutCategories, setWorkoutCategories] = useState<WorkoutCategory[]>([]);
  const [showOtherWorkouts, setShowOtherWorkouts] = useState(false);

  useEffect(() => {
    loadWorkoutTypes();
  }, []);

  useEffect(() => {
    if (clubId && workoutCategories.length > 0) {
      loadClub();
    }
  }, [clubId, workoutCategories]);

  const loadWorkoutTypes = async () => {
    try {
      const types = await workoutTypeService.getActiveWorkoutTypes(); // 활성화된 운동만
      setWorkoutCategories(getWorkoutCategories(types));
    } catch (error) {
      console.error('운동 종목 로드 실패:', error);
    }
  };

  const loadClub = async () => {
    if (!clubId) return;

    setLoading(true);
    try {
      const rows = await clubService.getClubMileageConfigs(clubId);

      if (rows.length > 0) {
        const config: MileageConfig = {};
        const enabled: string[] = [];
        rows.forEach((r) => {
          const key = r.sub_type ? `${r.category}-${r.sub_type}` : r.category;
          config[key] = r.coefficient;
          if (r.enabled) enabled.push(key);
        });
        setMileageConfig(config);
        setEnabledCategories(enabled);
      } else {
        // 마이그레이션 전 클럽 폴백
        const defaultConfig = await clubService.getDefaultMileageConfig();
        setMileageConfig(defaultConfig);
        setEnabledCategories(clubService.getDefaultEnabledCategories());
      }
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
      // 1. club_mileage_configs 테이블 업데이트
      const configs = workoutCategories.map((cat) => {
        const dashIdx = cat.key.indexOf('-');
        const category = dashIdx > -1 ? cat.key.substring(0, dashIdx) : cat.key;
        const sub_type = dashIdx > -1 ? cat.key.substring(dashIdx + 1) : null;
        return {
          category,
          sub_type,
          coefficient: mileageConfig[cat.key] ?? 1,
          enabled: enabledCategories.includes(cat.key),
        };
      });
      await clubService.updateClubMileageConfigs(clubId, configs);

      // 2. 현재 월의 모든 운동 기록 마일리지 재계산
      await clubService.recalculateCurrentMonthMileage(clubId, mileageConfig);

      alert(
        `마일리지 설정이 수정되었습니다.\n\n` +
        `✅ 활성화된 운동 종류: ${enabledCategories.length}개\n` +
        `✅ 이번 달 기록이 새로운 계수로 재계산되었습니다.`
      );
      // 클럽 페이지로 이동하여 변경사항 즉시 반영
      navigate('/club', { replace: true });
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
            {/* 기본운동 */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--primary-color)' }}>
                ⭐ 기본운동
              </h4>
              {workoutCategories.filter(c => c.is_core).map((category) => (
                <label key={category.key} className="category-checkbox-item">
                  <input
                    type="checkbox"
                    checked={enabledCategories.includes(category.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEnabledCategories([...enabledCategories, category.key]);
                      } else {
                        setEnabledCategories(enabledCategories.filter((k) => k !== category.key));
                      }
                    }}
                  />
                  <span>{category.emoji} {category.label}</span>
                </label>
              ))}
            </div>

            {/* 기타운동 (접기/펼치기) */}
            {workoutCategories.filter(c => !c.is_core).length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowOtherWorkouts(!showOtherWorkouts)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    marginBottom: showOtherWorkouts ? '12px' : '0',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    📦 기타운동
                  </span>
                  <span style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                    {showOtherWorkouts ? '▼' : '▶'}
                  </span>
                </button>

                {showOtherWorkouts && workoutCategories.filter(c => !c.is_core).map((category) => (
                  <label key={category.key} className="category-checkbox-item">
                    <input
                      type="checkbox"
                      checked={enabledCategories.includes(category.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEnabledCategories([...enabledCategories, category.key]);
                        } else {
                          setEnabledCategories(enabledCategories.filter((k) => k !== category.key));
                        }
                      }}
                    />
                    <span>{category.emoji} {category.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="settings-section" style={{ marginTop: '32px' }}>
          <h3>마일리지 계수 설정</h3>
          <p className="form-hint" style={{ marginBottom: '20px' }}>
            각 운동별 마일리지 계산 방식을 설정하세요.
          </p>
        </div>

        <div className="mileage-edit-list">
          {workoutCategories.map((category) => {
            if (!enabledCategories.includes(category.key)) return null;

            const step = category.unit === '분' ? 0.01 : 0.1;
            const unitLabel = category.unit === 'km' ? 'km' : category.unit === 'm' ? 'm' : category.unit === '분' ? '분' : '층';

            return (
              <div key={category.key} className="mileage-edit-item">
                <div className="mileage-edit-header">
                  <span className="mileage-edit-emoji">{category.emoji}</span>
                  <label>{category.label}</label>
                </div>
                <input
                  type="number"
                  step={step}
                  min={step}
                  value={mileageConfig[category.key as keyof MileageConfig] ?? ''}
                  onChange={(e) => handleMileageChange(category.key as keyof MileageConfig, e.target.value)}
                  className="mileage-input"
                  placeholder={`${unitLabel}당 1 마일리지`}
                />
                <div className="mileage-edit-preview">
                  {getExplanation(mileageConfig[category.key as keyof MileageConfig], category.unit)}
                </div>
              </div>
            );
          })}
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
