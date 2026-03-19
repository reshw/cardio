import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import workoutService from '../services/workoutService';
import { getCloudinaryThumbnail } from '../utils/cloudinary';
import type { Workout } from '../services/workoutService';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

type TabType = 'calendar' | 'list' | 'stats';

export const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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

  // 특정 날짜에 운동이 있는지 확인
  const hasWorkoutOnDate = (date: Date) => {
    return workouts.some((workout) => {
      const workoutDate = new Date(workout.created_at);
      return (
        workoutDate.getFullYear() === date.getFullYear() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getDate() === date.getDate()
      );
    });
  };

  // 특정 날짜의 운동 목록
  const getWorkoutsOnDate = (date: Date) => {
    return workouts.filter((workout) => {
      const workoutDate = new Date(workout.created_at);
      return (
        workoutDate.getFullYear() === date.getFullYear() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getDate() === date.getDate()
      );
    });
  };

  // 이번 달 통계
  const getCurrentMonthStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthWorkouts = workouts.filter((workout) => {
      const workoutDate = new Date(workout.created_at);
      return (
        workoutDate.getMonth() === currentMonth &&
        workoutDate.getFullYear() === currentYear
      );
    });

    const totalDistance = monthWorkouts
      .filter((w) => w.unit === 'km')
      .reduce((sum, w) => sum + w.value, 0);

    const uniqueDays = new Set(
      monthWorkouts.map((w) => new Date(w.created_at).toDateString())
    ).size;

    const categoryCount: Record<string, number> = {};
    monthWorkouts.forEach((w) => {
      const label = getWorkoutLabel(w);
      categoryCount[label] = (categoryCount[label] || 0) + 1;
    });

    return {
      totalWorkouts: monthWorkouts.length,
      totalDistance: totalDistance.toFixed(1),
      workoutDays: uniqueDays,
      categoryCount,
    };
  };

  const stats = getCurrentMonthStats();

  return (
    <div className="container">
      <div className="header">
        <h1>기록</h1>
        <button className="add-button" onClick={() => navigate('/add-workout')}>
          + 기록 추가
        </button>
      </div>

      {/* 탭 */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          📅 캘린더
        </button>
        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📝 리스트
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 통계
        </button>
      </div>

      {/* 캘린더 탭 */}
      {activeTab === 'calendar' && (
        <div className="tab-content">
          <div className="calendar-container">
            <Calendar
              locale="ko-KR"
              calendarType="gregory"
              tileClassName={({ date }) =>
                hasWorkoutOnDate(date) ? 'has-workout' : ''
              }
              onClickDay={(date) => setSelectedDate(date)}
            />
          </div>

          {selectedDate && (
            <div className="date-workouts">
              <h3>
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 운동
              </h3>
              {getWorkoutsOnDate(selectedDate).length === 0 ? (
                <p className="empty-message">이 날은 운동 기록이 없습니다.</p>
              ) : (
                <div className="workout-items">
                  {getWorkoutsOnDate(selectedDate).map((workout) => (
                    <div
                      key={workout.id}
                      className="workout-item clickable"
                      onClick={() => navigate(`/workout/${workout.id}`, { state: { workout } })}
                    >
                      <div className="workout-item-content">
                        <div className="workout-item-left">
                          <div className="workout-type-badge">
                            {getWorkoutLabel(workout)}
                          </div>
                          <div className="workout-distance">
                            {workout.value}
                            {workout.unit}
                          </div>
                        </div>
                        <div className="workout-item-right">
                          <div className="workout-date">
                            {formatDate(workout.created_at)}
                          </div>
                        </div>
                      </div>
                      {workout.proof_image && (
                        <div className="workout-proof-thumbnail">
                          <img src={getCloudinaryThumbnail(workout.proof_image, 600, 120)} alt="증빙" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 리스트 탭 */}
      {activeTab === 'list' && (
        <div className="tab-content">
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
                <div
                  key={workout.id}
                  className="workout-item clickable"
                  onClick={() => navigate(`/workout/${workout.id}`, { state: { workout } })}
                >
                  <div className="workout-item-content">
                    <div className="workout-item-left">
                      <div className="workout-type-badge">
                        {getWorkoutLabel(workout)}
                      </div>
                      <div className="workout-distance">
                        {workout.value}
                        {workout.unit}
                      </div>
                    </div>
                    <div className="workout-item-right">
                      <div className="workout-date">
                        {formatDate(workout.created_at)}
                      </div>
                    </div>
                  </div>
                  {workout.proof_image && (
                    <div className="workout-proof-thumbnail">
                      <img src={getCloudinaryThumbnail(workout.proof_image, 600, 120)} alt="증빙" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 통계 탭 */}
      {activeTab === 'stats' && (
        <div className="tab-content">
          <div className="stats-container">
            <h3>이번 달 운동 통계</h3>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">운동한 날</div>
                <div className="stat-value">{stats.workoutDays}일</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">총 운동 기록</div>
                <div className="stat-value">{stats.totalWorkouts}개</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">총 거리 (km)</div>
                <div className="stat-value">{stats.totalDistance}km</div>
              </div>
            </div>

            <div className="category-stats">
              <h4>운동 종류별 기록</h4>
              {Object.entries(stats.categoryCount).length === 0 ? (
                <p className="empty-message">이번 달 운동 기록이 없습니다.</p>
              ) : (
                <div className="category-list">
                  {Object.entries(stats.categoryCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => (
                      <div key={category} className="category-item">
                        <div className="category-name">{category}</div>
                        <div className="category-count">{count}개</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
