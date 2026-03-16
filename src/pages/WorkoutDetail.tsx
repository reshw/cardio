import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit2, Trash2, X } from 'lucide-react';
import workoutService from '../services/workoutService';
import type { Workout } from '../services/workoutService';
import { uploadToCloudinary } from '../utils/cloudinary';

export const WorkoutDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const workout = location.state?.workout as Workout;

  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(workout?.value.toString() || '');
  const [createdAt, setCreatedAt] = useState(
    workout ? new Date(workout.created_at).toISOString().slice(0, 16) : ''
  );
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!workout) {
    navigate('/');
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date
      .getHours()
      .toString()
      .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getWorkoutLabel = () => {
    if (workout.sub_type) {
      return `${workout.category} - ${workout.sub_type}`;
    }
    return workout.category;
  };

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

  const handleUpdate = async () => {
    if (!value || parseFloat(value) <= 0) {
      alert('올바른 값을 입력해주세요.');
      return;
    }

    setUpdating(true);

    try {
      let imageUrl = workout.proof_image;

      if (proofImage) {
        imageUrl = await uploadToCloudinary(proofImage);
      }

      await workoutService.updateWorkout(workout.id, {
        value: parseFloat(value),
        created_at: new Date(createdAt).toISOString(),
        proof_image: imageUrl,
      });

      alert('운동 기록이 수정되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('운동 기록 수정 실패:', error);
      alert('운동 기록 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 운동 기록을 삭제하시겠습니까?')) {
      return;
    }

    setDeleting(true);

    try {
      await workoutService.deleteWorkout(workout.id);
      alert('운동 기록이 삭제되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('운동 기록 삭제 실패:', error);
      alert('운동 기록 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container workout-detail-page">
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>운동 상세</h1>
      </div>

      <div className="detail-content">
        {!isEditing ? (
          <>
            <div className="detail-section">
              <div className="detail-label">운동 종류</div>
              <div className="detail-value">{getWorkoutLabel()}</div>
            </div>

            <div className="detail-section">
              <div className="detail-label">기록</div>
              <div className="detail-value">
                {workout.value}
                {workout.unit}
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-label">날짜</div>
              <div className="detail-value">{formatDate(workout.created_at)}</div>
            </div>

            {workout.proof_image && (
              <div className="detail-section">
                <div className="detail-label">증빙 이미지</div>
                <div
                  className="detail-proof-image"
                  onClick={() => setSelectedImage(workout.proof_image!)}
                >
                  <img src={workout.proof_image} alt="증빙" />
                </div>
              </div>
            )}
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
              <label htmlFor="edit-proof">증빙 이미지 변경</label>
              <input
                id="edit-proof"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="file-input"
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="새 증빙" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 고정 액션 버튼 */}
      <div className="detail-actions-fixed">
        {!isEditing ? (
          <>
            <button className="action-button-full" onClick={() => setIsEditing(true)}>
              <Edit2 size={18} />
              수정
            </button>
            <button className="action-button-full danger" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={18} />
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          </>
        ) : (
          <>
            <button
              className="action-button-full secondary"
              onClick={() => {
                setIsEditing(false);
                setValue(workout.value.toString());
                setCreatedAt(new Date(workout.created_at).toISOString().slice(0, 16));
                setProofImage(null);
                setImagePreview(null);
              }}
            >
              취소
            </button>
            <button className="action-button-full" onClick={handleUpdate} disabled={updating}>
              {updating ? '저장 중...' : '저장'}
            </button>
          </>
        )}
      </div>

      {/* 이미지 뷰어 */}
      {selectedImage && (
        <div className="image-viewer-overlay" onClick={() => setSelectedImage(null)}>
          <button className="image-viewer-close" onClick={() => setSelectedImage(null)}>
            <X size={32} />
          </button>
          <img
            src={selectedImage}
            alt="증빙 전체 이미지"
            className="image-viewer-content"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
