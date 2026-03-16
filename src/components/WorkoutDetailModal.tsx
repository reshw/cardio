import type { Workout } from '../services/workoutService';

interface Props {
  workout: Workout;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const WorkoutDetailModal = ({ workout, onClose, onDelete }: Props) => {
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

  const handleDelete = () => {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      onDelete(workout.id);
      onClose();
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
            <button className="delete-button-primary" onClick={handleDelete}>
              🗑️ 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
