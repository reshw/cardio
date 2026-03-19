import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import workoutService from '../services/workoutService';
import type { Workout } from '../services/workoutService';
import clubService from '../services/clubService';
import type { MileageConfig } from '../services/clubService';

export const ClubMemberDetail = () => {
  const { clubId, userId, userName } = useParams<{
    clubId: string;
    userId: string;
    userName: string;
  }>();
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mileageConfig, setMileageConfig] = useState<MileageConfig>(
    clubService.getDefaultMileageConfig()
  );

  useEffect(() => {
    if (clubId && userId) {
      loadClubConfig();
      loadWorkouts();
    }
  }, [clubId, userId]);

  const loadClubConfig = async () => {
    if (!clubId) return;

    try {
      const club = await clubService.getClubById(clubId);
      setMileageConfig(club.mileage_config || clubService.getDefaultMileageConfig());
    } catch (error) {
      console.error('클럽 정보 불러오기 실패:', error);
    }
  };

  const loadWorkouts = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const allWorkouts = await workoutService.getWorkoutsByUserId(userId);

      const monthWorkouts = allWorkouts.filter((workout) => {
        const workoutDate = new Date(workout.created_at);
        return workoutDate >= startDate && workoutDate <= endDate;
      });

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
    // 요가/복싱은 항상 "혼합"으로 표시
    if (workout.category === '요가' || workout.category === '복싱') {
      return `${workout.category}-혼합`;
    }
    if (workout.sub_type) {
      return `${workout.category}-${workout.sub_type}`;
    }
    return workout.category;
  };

  const calculateMileage = (workout: Workout) => {
    // 항상 클럽의 마일리지 계수로 재계산
    return clubService.calculateMileage(
      workout.category,
      workout.sub_type,
      workout.value,
      mileageConfig,
      workout.sub_type_ratios || undefined
    );
  };

  const totalMileage = workouts.reduce((sum, w) => sum + calculateMileage(w), 0);

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>{decodeURIComponent(userName || '')}님의 운동 기록</h1>
      </div>

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
        <div className="member-workout-list">
          {workouts.map((workout) => (
            <div key={workout.id} className="member-workout-card">
              <div className="workout-card-header">
                <div className="workout-type-badge">{getWorkoutLabel(workout)}</div>
                <div className="workout-date-small">{formatDate(workout.created_at)}</div>
              </div>
              <div className="workout-card-stats">
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
                <div
                  className="workout-proof-thumbnail"
                  onClick={() => setSelectedImage(workout.proof_image!)}
                >
                  <img src={workout.proof_image} alt="증빙" />
                  <div className="thumbnail-overlay">확대</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 이미지 뷰어 모달 */}
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
