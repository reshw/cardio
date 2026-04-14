import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import workoutService from '../services/workoutService';
import workoutTypeService from '../services/workoutTypeService';
import type { WorkoutType } from '../services/workoutTypeService';
import { uploadToR2 } from '../utils/r2Storage';
import type { WorkoutCategory, WorkoutSubType, WorkoutUnit } from '../services/workoutService';

export const AddWorkout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: 카테고리, 2: 세부타입, 3: 입력
  const [category, setCategory] = useState<WorkoutCategory | null>(null);
  const [subType, setSubType] = useState<WorkoutSubType>(null);
  const [subTypeRatio, setSubTypeRatio] = useState(50); // 0-100, 요가/복싱용 비율 슬라이더
  const [value, setValue] = useState('');
  const [workoutDate, setWorkoutDate] = useState(() => {
    // 현재 시간을 기본값으로 설정 (datetime-local 형식)
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localTime = new Date(now.getTime() - offset);
    return localTime.toISOString().slice(0, 16);
  });
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [intensity, setIntensity] = useState(4); // 기본값 4

  // 동적 운동 종목 로딩
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [showOtherWorkouts, setShowOtherWorkouts] = useState(false); // 기타운동 표시 여부

  useEffect(() => {
    const loadWorkoutTypes = async () => {
      try {
        const types = await workoutTypeService.getActiveWorkoutTypes();
        setWorkoutTypes(types);
      } catch (error) {
        console.error('운동 종목 로드 실패:', error);
        alert('운동 종목을 불러오는데 실패했습니다.');
      } finally {
        setLoadingTypes(false);
      }
    };
    loadWorkoutTypes();
  }, []);

  // 동적 카테고리 및 서브타입 매핑
  const CATEGORIES = workoutTypes.map((type) => ({
    id: type.name as WorkoutCategory,
    label: `${type.emoji} ${type.name}`,
    unit: type.unit as WorkoutUnit,
  }));

  const SUB_TYPES = workoutTypes.reduce((acc, type) => {
    acc[type.name] = type.sub_types || [];
    return acc;
  }, {} as Record<string, Array<{ name: string; unit: string }>>);

  const selectedCategory = CATEGORIES.find((c) => c.id === category);
  const selectedWorkoutType = workoutTypes.find((t) => t.name === category);
  const isMixedMode = selectedWorkoutType?.sub_type_mode === 'mixed';

  // 서브타입별 단위 동적 조회
  const getUnitForSubType = (): string => {
    if (subType && category) {
      const subTypes = SUB_TYPES[category];
      const selectedSubType = subTypes.find((st) => st.name === subType);
      if (selectedSubType) {
        return selectedSubType.unit;
      }
    }
    // 기본값: 메인 운동의 unit
    return selectedWorkoutType?.unit || '값';
  };

  const displayUnit = getUnitForSubType();

  // 카테고리 선택
  const handleCategorySelect = (cat: WorkoutCategory) => {
    setCategory(cat);
    const subTypes = SUB_TYPES[cat];
    if (subTypes.length > 0) {
      setStep(2);
    } else {
      setSubType(null);
      setStep(3);
    }
  };

  // 세부 타입 선택
  const handleSubTypeSelect = (sub: string) => {
    setSubType(sub as WorkoutSubType);
    setStep(3);
  };

  // 이미지 선택
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !category || !value || parseFloat(value) <= 0) {
      alert('모든 필드를 올바르게 입력해주세요.');
      return;
    }

    setUploading(true);

    try {
      let imageUrl: string | undefined;

      // 이미지가 있으면 R2에 업로드
      if (proofImage) {
        console.log('🖼️ R2 업로드 시작...');
        try {
          imageUrl = await uploadToR2(proofImage);
          console.log('✅ R2 업로드 성공:', imageUrl);
        } catch (uploadError) {
          console.error('❌ R2 업로드 실패:', uploadError);
          alert('이미지 업로드에 실패했습니다. 이미지 없이 저장하시겠습니까?');
          // 이미지 업로드 실패해도 계속 진행
        }
      }

      // 서브타입 비율 계산 (복합형만)
      let subTypeRatios: Record<string, number> | undefined;
      if (isMixedMode && subTypeRatio > 0 && subTypeRatio < 100) {
        const subTypes = SUB_TYPES[category];
        subTypeRatios = {
          [subTypes[0].name]: (100 - subTypeRatio) / 100,
          [subTypes[1].name]: subTypeRatio / 100,
        };
      }

      // 운동 기록 저장
      console.log('💾 운동 기록 저장 시작...');
      await workoutService.createWorkout({
        user_id: user.id,
        category,
        sub_type: subType,
        sub_type_ratios: subTypeRatios,
        value: parseFloat(value),
        unit: displayUnit as WorkoutUnit,
        intensity,
        proof_image: imageUrl,
        workout_time: new Date(workoutDate).toISOString(), // 사용자가 입력한 운동 시간
      });
      console.log('✅ 운동 기록 저장 성공');
      navigate('/');
    } catch (error) {
      console.error('❌ 운동 기록 저장 실패:', error);
      alert(`운동 기록 저장에 실패했습니다.\n${error instanceof Error ? error.message : ''}`);
    } finally {
      setUploading(false);
    }
  };

  // 뒤로 가기
  const handleBack = () => {
    if (step === 3) {
      const subTypes = category ? SUB_TYPES[category] : [];
      if (subTypes.length > 0) {
        setStep(2);
      } else {
        setStep(1);
      }
    } else if (step === 2) {
      setStep(1);
    } else {
      navigate(-1);
    }
  };

  // 운동 종목 로딩 중
  if (loadingTypes) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>운동 종목 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container add-workout-page">
      <div className="detail-header">
        <button className="back-button" onClick={handleBack}>
          <ChevronLeft size={24} />
        </button>
        <h1>운동 기록 추가</h1>
      </div>

      <div className="add-workout-content">
        {/* Step 1: 카테고리 선택 */}
        {step === 1 && (
          <div className="category-selection">
            <h3>운동 종류를 선택하세요</h3>

            {/* 기본운동 */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--primary-color)' }}>
                ⭐ 기본운동
              </h4>
              <div className="category-buttons">
                {CATEGORIES.filter(cat => {
                  const workoutType = workoutTypes.find(t => t.name === cat.id);
                  return workoutType?.is_core;
                }).map((cat) => (
                  <button
                    key={cat.id}
                    className="category-button"
                    onClick={() => handleCategorySelect(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 기타운동 (접힘/펼침) */}
            <div>
              <button
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

              {showOtherWorkouts && (
                <div className="category-buttons">
                  {CATEGORIES.filter(cat => {
                    const workoutType = workoutTypes.find(t => t.name === cat.id);
                    return !workoutType?.is_core;
                  }).map((cat) => (
                    <button
                      key={cat.id}
                      className="category-button"
                      onClick={() => handleCategorySelect(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: 세부 타입 선택 */}
        {step === 2 && category && (
          <div className="subtype-selection">
            <h3>{selectedCategory?.label} 세부 종류</h3>

            {/* 복합형: 비율 슬라이더 */}
            {isMixedMode ? (
              <div className="subtype-ratio-selector">
                <p className="ratio-description">
                  두 종류를 섞어서 했나요? 비율을 조정하세요.
                </p>

                <div className="ratio-labels">
                  <span className="ratio-label-left">{SUB_TYPES[category][0].name}</span>
                  <span className="ratio-label-right">{SUB_TYPES[category][1].name}</span>
                </div>

                <div className="ratio-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={subTypeRatio}
                    onChange={(e) => setSubTypeRatio(Number(e.target.value))}
                    className="ratio-slider"
                  />
                  <div className="ratio-values">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={100 - subTypeRatio}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setSubTypeRatio(100 - val);
                        }
                      }}
                      className="ratio-input"
                    />
                    <span>%</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={subTypeRatio}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setSubTypeRatio(val);
                        }
                      }}
                      className="ratio-input"
                    />
                    <span>%</span>
                  </div>
                </div>

                <button
                  className="primary-button"
                  onClick={() => {
                    // 비율이 0% 또는 100%면 단일 서브타입
                    if (subTypeRatio === 0) {
                      setSubType(SUB_TYPES[category][0].name as WorkoutSubType);
                    } else if (subTypeRatio === 100) {
                      setSubType(SUB_TYPES[category][1].name as WorkoutSubType);
                    } else {
                      // 혼합: 대표 서브타입을 첫 번째로 설정 (표시용)
                      setSubType(SUB_TYPES[category][0].name as WorkoutSubType);
                    }
                    setStep(3);
                  }}
                >
                  다음
                </button>
              </div>
            ) : (
              /* 선택형: 버튼 선택 */
              <div className="subtype-buttons">
                {SUB_TYPES[category].map((sub) => (
                  <button
                    key={sub.name}
                    className="subtype-button"
                    onClick={() => handleSubTypeSelect(sub.name)}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: 값 입력 */}
        {step === 3 && category && (
          <form onSubmit={handleSubmit} className="workout-form-page">
            <div className="input-section">
              <h3>
                {selectedCategory?.label}
                {/* 비율이 있는 경우 (복합형 혼합) */}
                {isMixedMode && subTypeRatio > 0 && subTypeRatio < 100 ? (
                  <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                    <br />
                    {SUB_TYPES[category][0].name} {100 - subTypeRatio}% / {SUB_TYPES[category][1].name} {subTypeRatio}%
                  </span>
                ) : (
                  subType && ` - ${subType}`
                )}
              </h3>

              <div className="form-group">
                <label htmlFor="value">{displayUnit}</label>
                <div className="input-with-unit">
                  <input
                    id="value"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="예: 5.25"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="value-input"
                    required
                  />
                  <span className="unit-label">{displayUnit}</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="workout-date">운동 날짜 및 시간</label>
                <input
                  id="workout-date"
                  type="datetime-local"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  className="value-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>체감 난이도</label>

                {/* 스펙트럼 바 */}
                <div className="difficulty-spectrum-bar">
                  <div className="spectrum-gradient"></div>
                  <div
                    className="spectrum-indicator"
                    style={{ left: `${(intensity * 10) - 5}%` }}
                  ></div>
                </div>

                {/* 5단계 버튼 */}
                <div className="difficulty-levels">
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity <= 2 ? 'active' : ''}`}
                    onClick={() => setIntensity(2)}
                  >
                    <div className="difficulty-number">1</div>
                    <div className="difficulty-label">편안</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 3 && intensity <= 4 ? 'active' : ''}`}
                    onClick={() => setIntensity(4)}
                  >
                    <div className="difficulty-number">2</div>
                    <div className="difficulty-label">경쾌</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 5 && intensity <= 6 ? 'active' : ''}`}
                    onClick={() => setIntensity(6)}
                  >
                    <div className="difficulty-number">3</div>
                    <div className="difficulty-label">자극</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 7 && intensity <= 8 ? 'active' : ''}`}
                    onClick={() => setIntensity(8)}
                  >
                    <div className="difficulty-number">4</div>
                    <div className="difficulty-label">고강도</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 9 ? 'active' : ''}`}
                    onClick={() => setIntensity(10)}
                  >
                    <div className="difficulty-number">5</div>
                    <div className="difficulty-label">한계돌파</div>
                  </button>
                </div>

                {/* 세부 조정 */}
                {intensity > 0 && (
                  <div className="difficulty-fine-tune">
                    <button
                      type="button"
                      className="fine-tune-adjust-btn"
                      onClick={() => {
                        const min = intensity <= 2 ? 1 : intensity <= 4 ? 3 : intensity <= 6 ? 5 : intensity <= 8 ? 7 : 9;
                        if (intensity > min) setIntensity(intensity - 1);
                      }}
                      disabled={
                        intensity === 1 || intensity === 3 || intensity === 5 || intensity === 7 || intensity === 9
                      }
                    >
                      ◀ 조금 더 낮게
                    </button>
                    <button
                      type="button"
                      className="fine-tune-adjust-btn"
                      onClick={() => {
                        const max = intensity <= 2 ? 2 : intensity <= 4 ? 4 : intensity <= 6 ? 6 : intensity <= 8 ? 8 : 10;
                        if (intensity < max) setIntensity(intensity + 1);
                      }}
                      disabled={
                        intensity === 2 || intensity === 4 || intensity === 6 || intensity === 8 || intensity === 10
                      }
                    >
                      조금 더 높게 ▶
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="proof">증빙 이미지 (선택)</label>
                <input
                  id="proof"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
                />
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="미리보기" />
                  </div>
                )}
              </div>

              <div className="form-actions-fixed">
                <button
                  type="submit"
                  className="primary-button-full"
                  disabled={uploading}
                >
                  {uploading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
