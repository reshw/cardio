import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import workoutService from '../services/workoutService';
import type { Workout } from '../services/workoutService';
import clubService from '../services/clubService';
import feedService from '../services/feedService';
import { useAuth } from '../contexts/AuthContext';

export const ClubMemberDetail = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();

  const state = location.state as { tab?: string; userId?: string; userName?: string } | null;
  const userId = state?.userId;
  const userName = state?.userName;

  // state 없이 직접 URL 접근 차단
  useEffect(() => {
    if (!userId) {
      navigate('/club', { replace: true });
    }
  }, [userId, navigate]);

  const goBack = () => navigate('/club', { state: { tab: state?.tab } });
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [mileageMap, setMileageMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (clubId && userId) {
      checkBlocked();
      loadWorkouts();
    }
  }, [clubId, userId]);

  const checkBlocked = async () => {
    if (!currentUser || !userId) return;
    const blockedIds = await feedService.getMyBlockedIds(currentUser.id, clubId!);
    setIsBlocked(blockedIds.includes(userId!));
  };

  const loadWorkouts = async () => {
    if (!userId || !clubId) return;

    setLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const allWorkouts = await workoutService.getWorkoutsByUserId(userId);

      const monthWorkouts = allWorkouts.filter((workout) => {
        const workoutDate = new Date(workout.workout_time);
        return workoutDate >= startDate && workoutDate <= endDate;
      });

      monthWorkouts.sort(
        (a, b) => new Date(b.workout_time).getTime() - new Date(a.workout_time).getTime()
      );

      setWorkouts(monthWorkouts);

      // club_workout_mileage 스냅샷에서 마일리지 로드
      const mileageDetails = await clubService.getUserWorkoutMileageDetails(clubId, userId, year, month);
      const newMap = new Map<string, number>();
      mileageDetails.forEach((r) => newMap.set(r.workout_id, r.mileage));
      setMileageMap(newMap);
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

  const getMileage = (workout: Workout) => mileageMap.get(workout.id) ?? 0;

  const getRatioDisplay = (workout: Workout) => {
    if (workout.category !== '요가' && workout.category !== '복싱') return null;
    if (!workout.sub_type_ratios) return null;
    const entries = Object.entries(workout.sub_type_ratios as Record<string, number>);
    if (entries.length === 0 || (entries.length === 1 && entries[0][1] === 1.0)) return null;
    return entries.map(([type, ratio]) => `${type} ${Math.round(ratio * 100)}%`).join(' | ');
  };

  const getIntensityLabel = (intensity: number) => {
    if (intensity <= 2) return '편안';
    if (intensity <= 4) return '경쾌';
    if (intensity <= 6) return '자극';
    if (intensity <= 8) return '고강도';
    return '한계돌파';
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 2) return '#4ade80';
    if (intensity <= 4) return '#22c55e';
    if (intensity <= 6) return '#eab308';
    if (intensity <= 8) return '#f97316';
    if (intensity === 9) return '#ef4444';
    return '#dc2626';
  };

  const totalMileage = workouts.reduce((sum, w) => sum + (mileageMap.get(w.id) ?? 0), 0);

  if (isBlocked) {
    return (
      <div className="container">
        <div className="header">
          <button className="back-button" onClick={goBack}>
            <ChevronLeft size={24} />
          </button>
          <h1>{decodeURIComponent(userName || '')}</h1>
        </div>
        <div className="blocked-user-screen">
          <div className="blocked-user-icon">🚫</div>
          <p className="blocked-user-title">차단된 유저입니다</p>
          <p className="blocked-user-desc">
            이 유저를 차단했습니다.<br />
            차단을 해제하려면 더보기 → 차단한 멤버 관리에서 해제할 수 있습니다.
          </p>
          <button className="btn-secondary" onClick={() => navigate('/blocked-members')}>
            차단 멤버 관리
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={goBack}>
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
            <div
              key={workout.id}
              className="member-workout-card"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedWorkout(workout)}
            >
              <div className="workout-card-header">
                <div className="workout-type-badge">{getWorkoutLabel(workout)}</div>
                <div className="workout-date-small">{formatDate(workout.workout_time)}</div>
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
                    {getMileage(workout).toFixed(1)}
                  </span>
                </div>
              </div>
              {workout.proof_image && (
                <div className="workout-proof-thumbnail">
                  <img src={workout.proof_image} alt="증빙" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 운동 상세 모달 */}
      {selectedWorkout && (
        <div className="modal-overlay" onClick={() => setSelectedWorkout(null)}>
          <div className="modal-content workout-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>운동 상세</h2>
              <button className="modal-close" onClick={() => setSelectedWorkout(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="workout-detail-section">
                <h3>운동 정보</h3>
                <div className="workout-detail-info">
                  <div className="workout-detail-row">
                    <span className="label">종류</span>
                    <span className="value">
                      {getWorkoutLabel(selectedWorkout)}
                      {getRatioDisplay(selectedWorkout) && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {getRatioDisplay(selectedWorkout)}
                        </div>
                      )}
                    </span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">거리/시간</span>
                    <span className="value">{selectedWorkout.value} {selectedWorkout.unit}</span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">마일리지</span>
                    <span className="value">{(mileageMap.get(selectedWorkout.id) ?? 0).toFixed(1)}</span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">체감 난이도</span>
                    <span className="value intensity-value" style={{ color: getIntensityColor(selectedWorkout.intensity) }}>
                      {getIntensityLabel(selectedWorkout.intensity)}
                    </span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">시간</span>
                    <span className="value">{new Date(selectedWorkout.workout_time).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              </div>

              {selectedWorkout.proof_image && (
                <div className="workout-detail-section">
                  <h3>인증 사진</h3>
                  <div
                    className="workout-detail-image"
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setSelectedImage(selectedWorkout.proof_image!)}
                  >
                    <img src={selectedWorkout.proof_image} alt="운동 인증" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
