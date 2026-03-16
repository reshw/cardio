import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import workoutService from '../services/workoutService';
import type { Workout } from '../services/workoutService';
import clubService from '../services/clubService';

interface ClubMemberDetailModalProps {
  userId: string;
  userName: string;
  month: { year: number; month: number };
  onClose: () => void;
}

export const ClubMemberDetailModal = ({
  userId,
  userName,
  month,
  onClose,
}: ClubMemberDetailModalProps) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWorkouts();
  }, [userId, month]);

  const loadWorkouts = async () => {
    setLoading(true);
    try {
      // 해당 월의 시작일과 종료일 계산
      const startDate = new Date(month.year, month.month - 1, 1);
      const endDate = new Date(month.year, month.month, 0, 23, 59, 59);

      // 모든 운동 기록 가져오기
      const allWorkouts = await workoutService.getWorkoutsByUserId(userId);

      // 해당 월의 운동만 필터링
      const monthWorkouts = allWorkouts.filter((workout) => {
        const workoutDate = new Date(workout.created_at);
        return workoutDate >= startDate && workoutDate <= endDate;
      });

      // 날짜 순으로 정렬 (최신순)
      monthWorkouts.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setWorkouts(monthWorkouts);
    } catch (error) {
      console.error('운동 기록 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}월 ${date.getDate()}일 ${date
      .getHours()
      .toString()
      .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getWorkoutLabel = (workout: Workout) => {
    if (workout.sub_type) {
      return `${workout.category} - ${workout.sub_type}`;
    }
    return workout.category;
  };

  const calculateMileage = (workout: Workout) => {
    if (workout.mileage) return workout.mileage;
    return clubService.calculateMileage(workout.category, workout.sub_type, workout.value);
  };

  const totalMileage = workouts.reduce((sum, w) => sum + calculateMileage(w), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {userName}님의 운동 기록
            <span style={{ fontSize: '16px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
              {month.year}년 {month.month}월
            </span>
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>불러오는 중...</p>
            </div>
          ) : workouts.length === 0 ? (
            <div className="empty-state">
              <p>이번 달 운동 기록이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="member-detail-summary">
                <div className="summary-item">
                  <div className="summary-label">총 운동</div>
                  <div className="summary-value">{workouts.length}회</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">총 마일리지</div>
                  <div className="summary-value">{totalMileage.toFixed(1)}</div>
                </div>
              </div>

              <div className="member-workout-list">
                {workouts.map((workout) => (
                  <div key={workout.id} className="member-workout-item">
                    <div className="workout-item-header">
                      <div className="workout-type-badge">{getWorkoutLabel(workout)}</div>
                      <div className="workout-date-small">{formatDate(workout.created_at)}</div>
                    </div>
                    <div className="workout-item-stats">
                      <div className="stat-item">
                        <span className="stat-label">거리/횟수</span>
                        <span className="stat-value">
                          {workout.value}
                          {workout.unit}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">마일리지</span>
                        <span className="stat-value highlight">
                          {calculateMileage(workout).toFixed(1)}
                        </span>
                      </div>
                    </div>
                    {workout.proof_image && (
                      <div className="workout-proof-image">
                        <img src={workout.proof_image} alt="운동 증빙" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
