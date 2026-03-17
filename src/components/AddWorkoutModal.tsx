import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import workoutService from '../services/workoutService';
import { uploadToCloudinary } from '../utils/cloudinary';
import type { WorkoutCategory, WorkoutSubType, WorkoutUnit } from '../services/workoutService';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { id: '달리기' as WorkoutCategory, label: '🏃 달리기', unit: 'km' as WorkoutUnit },
  { id: '사이클' as WorkoutCategory, label: '🚴 사이클', unit: 'km' as WorkoutUnit },
  { id: '수영' as WorkoutCategory, label: '🏊 수영', unit: 'm' as WorkoutUnit },
  { id: '계단' as WorkoutCategory, label: '🪜 계단', unit: '층' as WorkoutUnit },
  { id: '복싱' as WorkoutCategory, label: '🥊 복싱', unit: '분' as WorkoutUnit },
  { id: '요가' as WorkoutCategory, label: '🧘 요가', unit: '분' as WorkoutUnit },
];

const SUB_TYPES = {
  달리기: ['트레드밀', '러닝'],
  사이클: ['실외', '실내'],
  수영: [],
  계단: [],
  복싱: ['샌드백/미트', '스파링'],
  요가: ['일반', '빈야사/아쉬탕가'],
};

export const AddWorkoutModal = ({ onClose, onSuccess }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: 카테고리, 2: 세부타입, 3: 입력
  const [category, setCategory] = useState<WorkoutCategory | null>(null);
  const [subType, setSubType] = useState<WorkoutSubType>(null);
  const [value, setValue] = useState('');
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [intensity, setIntensity] = useState(4); // 기본값 4

  const selectedCategory = CATEGORIES.find((c) => c.id === category);

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

      // 이미지가 있으면 Cloudinary에 업로드
      if (proofImage) {
        console.log('🖼️ Cloudinary 업로드 시작...');
        try {
          imageUrl = await uploadToCloudinary(proofImage);
          console.log('✅ Cloudinary 업로드 성공:', imageUrl);
        } catch (uploadError) {
          console.error('❌ Cloudinary 업로드 실패:', uploadError);
          alert('이미지 업로드에 실패했습니다. 이미지 없이 저장하시겠습니까?');
          // 이미지 업로드 실패해도 계속 진행
        }
      }

      // 운동 기록 저장
      console.log('💾 운동 기록 저장 시작...');
      await workoutService.createWorkout({
        user_id: user.id,
        category,
        sub_type: subType,
        value: parseFloat(value),
        unit: selectedCategory!.unit,
        intensity,
        proof_image: imageUrl,
      });
      console.log('✅ 운동 기록 저장 성공');

      onSuccess();
      onClose();
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
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>운동 기록 추가</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Step 1: 카테고리 선택 */}
          {step === 1 && (
            <div className="category-selection">
              <h3>운동 종류를 선택하세요</h3>
              <div className="category-buttons">
                {CATEGORIES.map((cat) => (
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
          )}

          {/* Step 2: 세부 타입 선택 */}
          {step === 2 && category && (
            <div className="subtype-selection">
              <h3>{selectedCategory?.label} 세부 종류</h3>
              <div className="subtype-buttons">
                {SUB_TYPES[category].map((sub) => (
                  <button
                    key={sub}
                    className="subtype-button"
                    onClick={() => handleSubTypeSelect(sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
              <button className="back-button" onClick={handleBack}>
                ← 뒤로
              </button>
            </div>
          )}

          {/* Step 3: 값 입력 */}
          {step === 3 && category && (
            <form onSubmit={handleSubmit}>
              <div className="input-section">
                <h3>
                  {selectedCategory?.label}
                  {subType && ` - ${subType}`}
                </h3>

                <div className="form-group">
                  <label htmlFor="value">거리/시간/층수</label>
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
                    <span className="unit-label">{selectedCategory?.unit}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="intensity">
                    운동 강도: {intensity}단계
                    <span className="intensity-label">
                      {intensity <= 2
                        ? ' (매우 가벼움)'
                        : intensity <= 4
                        ? ' (가벼움)'
                        : intensity <= 6
                        ? ' (보통)'
                        : intensity <= 8
                        ? ' (힘듦)'
                        : intensity === 9
                        ? ' (매우 힘듦)'
                        : ' (최대/한계)'}
                    </span>
                  </label>
                  <input
                    id="intensity"
                    type="range"
                    min="1"
                    max="10"
                    value={intensity}
                    onChange={(e) => setIntensity(parseInt(e.target.value))}
                    className="intensity-slider"
                  />
                  <div className="intensity-markers">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                    <span>6</span>
                    <span>7</span>
                    <span>8</span>
                    <span>9</span>
                    <span>10</span>
                  </div>
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

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={handleBack}
                  >
                    뒤로
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
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
    </div>
  );
};
