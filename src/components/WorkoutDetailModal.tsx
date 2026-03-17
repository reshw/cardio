import { useState } from 'react';
import workoutService from '../services/workoutService';
import { uploadToCloudinary } from '../utils/cloudinary';
import type { Workout } from '../services/workoutService';
import { Edit2, Trash2 } from 'lucide-react';

interface Props {
  workout: Workout;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export const WorkoutDetailModal = ({ workout, onClose, onDelete, onUpdate }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(workout.value.toString());
  const [createdAt, setCreatedAt] = useState(
    new Date(workout.created_at).toISOString().slice(0, 16)
  );
  const [intensity, setIntensity] = useState(workout.intensity);
  const [newProofImage, setNewProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getWorkoutLabel = () => {
    if (workout.sub_type) {
      return `${workout.category} - ${workout.sub_type}`;
    }
    return workout.category;
  };

  const getIntensityLabel = (intensity: number) => {
    if (intensity <= 2) return '가벼운 산책';
    if (intensity <= 4) return '기분좋은 조깅';
    if (intensity <= 6) return '약간 숨참';
    if (intensity <= 8) return '힘듬';
    return '한계 돌파';
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 2) return '#4ade80';
    if (intensity <= 4) return '#22c55e';
    if (intensity <= 6) return '#eab308';
    if (intensity <= 8) return '#f97316';
    if (intensity === 9) return '#ef4444';
    return '#dc2626';
  };

  const handleDelete = () => {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      onDelete(workout.id);
      onClose();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async () => {
    if (!value || parseFloat(value) <= 0) {
      alert('올바른 값을 입력해주세요.');
      return;
    }

    setUpdating(true);

    try {
      let proofImageUrl = workout.proof_image;

      // 새 이미지가 있으면 업로드
      if (newProofImage) {
        proofImageUrl = await uploadToCloudinary(newProofImage);
      }

      await workoutService.updateWorkout(workout.id, {
        value: parseFloat(value),
        created_at: new Date(createdAt).toISOString(),
        intensity,
        proof_image: proofImageUrl,
      });

      alert('운동 기록이 수정되었습니다.');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('수정 실패:', error);
      alert('운동 기록 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content workout-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>운동 상세</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!isEditing ? (
            <>
              <div className="detail-section">
                <div className="detail-label">운동 종류</div>
                <div className="detail-value workout-type-badge">{getWorkoutLabel()}</div>
              </div>

              <div className="detail-section">
                <div className="detail-label">기록</div>
                <div className="detail-value detail-distance">
                  {workout.value} {workout.unit}
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-label">체감 난이도</div>
                <div
                  className="detail-value"
                  style={{ color: getIntensityColor(workout.intensity), fontWeight: 600 }}
                >
                  {getIntensityLabel(workout.intensity)}
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-label">날짜</div>
                <div className="detail-value">{formatDate(workout.created_at)}</div>
              </div>

              {workout.proof_image && (
                <div className="detail-section">
                  <div className="detail-label">증빙 이미지</div>
                  <div className="detail-image">
                    <img src={workout.proof_image} alt="증빙" />
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="cancel-button" onClick={onClose}>
                  닫기
                </button>
                <button className="action-button" onClick={() => setIsEditing(true)}>
                  <Edit2 size={16} />
                  수정
                </button>
                <button className="delete-button-primary" onClick={handleDelete}>
                  <Trash2 size={16} />
                  삭제
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="edit-value">기록 ({workout.unit})</label>
                <input
                  id="edit-value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="value-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-date">날짜 및 시간</label>
                <input
                  id="edit-date"
                  type="datetime-local"
                  value={createdAt}
                  onChange={(e) => setCreatedAt(e.target.value)}
                  className="value-input"
                />
              </div>

              <div className="form-group">
                <label>체감 난이도</label>
                <div className="difficulty-levels">
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity <= 2 ? 'active' : ''}`}
                    onClick={() => setIntensity(2)}
                  >
                    <div className="difficulty-number">1</div>
                    <div className="difficulty-label">가벼운 산책</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 3 && intensity <= 4 ? 'active' : ''}`}
                    onClick={() => setIntensity(4)}
                  >
                    <div className="difficulty-number">2</div>
                    <div className="difficulty-label">기분좋은 조깅</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 5 && intensity <= 6 ? 'active' : ''}`}
                    onClick={() => setIntensity(6)}
                  >
                    <div className="difficulty-number">3</div>
                    <div className="difficulty-label">약간 숨참</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 7 && intensity <= 8 ? 'active' : ''}`}
                    onClick={() => setIntensity(8)}
                  >
                    <div className="difficulty-number">4</div>
                    <div className="difficulty-label">힘듬</div>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-level-btn ${intensity >= 9 ? 'active' : ''}`}
                    onClick={() => setIntensity(10)}
                  >
                    <div className="difficulty-number">5</div>
                    <div className="difficulty-label">한계 돌파</div>
                  </button>
                </div>
                {intensity > 0 && (
                  <div className="difficulty-fine-tune">
                    <label>세부 조정</label>
                    <div className="fine-tune-buttons">
                      {intensity <= 2 && (
                        <>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 1 ? 'active' : ''}`}
                            onClick={() => setIntensity(1)}
                          >
                            낮음
                          </button>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 2 ? 'active' : ''}`}
                            onClick={() => setIntensity(2)}
                          >
                            높음
                          </button>
                        </>
                      )}
                      {intensity >= 3 && intensity <= 4 && (
                        <>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 3 ? 'active' : ''}`}
                            onClick={() => setIntensity(3)}
                          >
                            낮음
                          </button>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 4 ? 'active' : ''}`}
                            onClick={() => setIntensity(4)}
                          >
                            높음
                          </button>
                        </>
                      )}
                      {intensity >= 5 && intensity <= 6 && (
                        <>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 5 ? 'active' : ''}`}
                            onClick={() => setIntensity(5)}
                          >
                            낮음
                          </button>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 6 ? 'active' : ''}`}
                            onClick={() => setIntensity(6)}
                          >
                            높음
                          </button>
                        </>
                      )}
                      {intensity >= 7 && intensity <= 8 && (
                        <>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 7 ? 'active' : ''}`}
                            onClick={() => setIntensity(7)}
                          >
                            낮음
                          </button>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 8 ? 'active' : ''}`}
                            onClick={() => setIntensity(8)}
                          >
                            높음
                          </button>
                        </>
                      )}
                      {intensity >= 9 && (
                        <>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 9 ? 'active' : ''}`}
                            onClick={() => setIntensity(9)}
                          >
                            낮음
                          </button>
                          <button
                            type="button"
                            className={`fine-tune-btn ${intensity === 10 ? 'active' : ''}`}
                            onClick={() => setIntensity(10)}
                          >
                            높음
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-proof">증빙 이미지 변경 (선택)</label>
                <input
                  id="edit-proof"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
                />
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="새 증빙" />
                  </div>
                ) : workout.proof_image ? (
                  <div className="image-preview">
                    <img src={workout.proof_image} alt="기존 증빙" />
                  </div>
                ) : null}
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => {
                    setIsEditing(false);
                    setValue(workout.value.toString());
                    setCreatedAt(new Date(workout.created_at).toISOString().slice(0, 16));
                    setIntensity(workout.intensity);
                    setNewProofImage(null);
                    setImagePreview(null);
                  }}
                >
                  취소
                </button>
                <button
                  className="primary-button"
                  onClick={handleUpdate}
                  disabled={updating}
                >
                  {updating ? '수정 중...' : '저장'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
