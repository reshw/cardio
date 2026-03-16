import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import workoutService from '../services/workoutService';
import { AddWorkoutModal } from '../components/AddWorkoutModal';
import type { Workout } from '../services/workoutService';

export const History = () => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 운동 기록 불러오기
  const loadWorkouts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await workoutService.getWorkoutsByUserId(user.id);
      setWorkouts(data);
    } catch (error) {
      console.error('운동 기록 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkouts();
  }, [user]);

  // 운동 기록 삭제
  const handleDelete = async (workoutId: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;

    try {
      await workoutService.deleteWorkout(workoutId);
      loadWorkouts();
    } catch (error) {
      console.error('운동 기록 삭제 실패:', error);
      alert('운동 기록 삭제에 실패했습니다.');
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `오늘 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
  };

  // 운동 표시명
  const getWorkoutLabel = (workout: Workout) => {
    if (workout.sub_type) {
      return `${workout.category} - ${workout.sub_type}`;
    }
    return workout.category;
  };

  return (
    <div className="container">
      <div className="header">
        <h1>기록</h1>
        <button className="add-button" onClick={() => setShowModal(true)}>
          + 기록 추가
        </button>
      </div>

      {/* 운동 기록 목록 */}
      <div className="workout-list">
        {loading ? (
          <div className="loading-screen">
            <div className="spinner"></div>
            <p>불러오는 중...</p>
          </div>
        ) : workouts.length === 0 ? (
          <div className="empty-state">
            <p>아직 운동 기록이 없습니다.</p>
            <p>첫 운동을 기록해보세요!</p>
          </div>
        ) : (
          <div className="workout-items">
            {workouts.map((workout) => (
              <div key={workout.id} className="workout-item">
                <div className="workout-item-content">
                  <div className="workout-item-left">
                    <div className="workout-type-badge">{getWorkoutLabel(workout)}</div>
                    <div className="workout-distance">
                      {workout.value}
                      {workout.unit}
                    </div>
                  </div>
                  <div className="workout-item-right">
                    <div className="workout-date">{formatDate(workout.created_at)}</div>
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(workout.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {workout.proof_image && (
                  <div className="workout-proof">
                    <img src={workout.proof_image} alt="증빙" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <AddWorkoutModal
          onClose={() => setShowModal(false)}
          onSuccess={loadWorkouts}
        />
      )}
    </div>
  );
};
