import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import workoutService from '../services/workoutService';
import { getThumbnail } from '../utils/r2Storage';
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

    // 오늘, 어제 판단을 위해 날짜만 비교 (시간 제거)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const workoutDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today.getTime() - workoutDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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
    // 요가/복싱은 항상 "혼합"으로 표시
    if (workout.category === '요가' || workout.category === '복싱') {
      return `${workout.category}-혼합`;
    }
    if (workout.sub_type) {
      return `${workout.category}-${workout.sub_type}`;
    }
    return workout.category;
  };

  // 특정 날짜에 운동이 있는지 확인
  const hasWorkoutOnDate = (date: Date) => {
    return workouts.some((workout) => {
      const workoutDate = new Date(workout.workout_time);
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
      const workoutDate = new Date(workout.workout_time);
      return (
        workoutDate.getFullYear() === date.getFullYear() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getDate() === date.getDate()
      );
    });
  };

  const now = new Date();
  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [statsMonth, setStatsMonth] = useState(now.getMonth());
  // null = 월/년 표시, 'month' = 월 선택, 'year' = 연 선택
  const [pickerMode, setPickerMode] = useState<null | 'month' | 'year'>(null);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  const goToPrevMonth = () => {
    if (statsMonth === 0) { setStatsYear(y => y - 1); setStatsMonth(11); }
    else setStatsMonth(m => m - 1);
  };

  const goToNextMonth = () => {
    const isCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth();
    if (isCurrentMonth) return;
    if (statsMonth === 11) { setStatsYear(y => y + 1); setStatsMonth(0); }
    else setStatsMonth(m => m + 1);
  };

  const openPicker = () => {
    setPickerYear(statsYear);
    setPickerMode('month');
  };

  const selectMonth = (m: number) => {
    const isFuture = pickerYear > now.getFullYear() ||
      (pickerYear === now.getFullYear() && m > now.getMonth());
    if (isFuture) return;
    setStatsYear(pickerYear);
    setStatsMonth(m);
    setPickerMode(null);
  };

  const selectYear = (y: number) => {
    setPickerYear(y);
    setPickerMode('month');
  };

  // 선택 월 통계
  const getCurrentMonthStats = () => {
    const monthWorkouts = workouts.filter((workout) => {
      const workoutDate = new Date(workout.workout_time);
      return (
        workoutDate.getMonth() === statsMonth &&
        workoutDate.getFullYear() === statsYear
      );
    });

    const totalDistance = monthWorkouts
      .filter((w) => w.unit === 'km')
      .reduce((sum, w) => sum + w.value, 0);

    const uniqueDays = new Set(
      monthWorkouts.map((w) => new Date(w.workout_time).toDateString())
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
  const isCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth();

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
                            {formatDate(workout.workout_time)}
                          </div>
                        </div>
                      </div>
                      {workout.proof_image && (
                        <div className="workout-proof-thumbnail">
                          <img src={getThumbnail(workout.proof_image, 600, 120)} alt="증빙" />
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
                        {formatDate(workout.workout_time)}
                      </div>
                    </div>
                  </div>
                  {workout.proof_image && (
                    <div className="workout-proof-thumbnail">
                      <img src={getThumbnail(workout.proof_image, 600, 120)} alt="증빙" />
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
            <div className="stats-month-nav">
              <button className="month-nav-btn" onClick={goToPrevMonth}>‹</button>
              <button className="month-nav-label" onClick={openPicker}>
                {statsYear}년 {statsMonth + 1}월
              </button>
              <button
                className="month-nav-btn"
                onClick={goToNextMonth}
                disabled={isCurrentMonth}
              >›</button>
            </div>

            {pickerMode === 'month' && (
              <div className="stats-picker">
                <div className="picker-year-row">
                  <button className="month-nav-btn" onClick={() => setPickerYear(y => y - 1)}>‹</button>
                  <button className="month-nav-label" onClick={() => setPickerMode('year')}>{pickerYear}년</button>
                  <button
                    className="month-nav-btn"
                    onClick={() => setPickerYear(y => y + 1)}
                    disabled={pickerYear >= now.getFullYear()}
                  >›</button>
                </div>
                <div className="picker-month-grid">
                  {Array.from({ length: 12 }, (_, i) => {
                    const isFuture = pickerYear > now.getFullYear() ||
                      (pickerYear === now.getFullYear() && i > now.getMonth());
                    const isSelected = pickerYear === statsYear && i === statsMonth;
                    return (
                      <button
                        key={i}
                        className={`picker-month-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => selectMonth(i)}
                        disabled={isFuture}
                      >
                        {i + 1}월
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {pickerMode === 'year' && (
              <div className="stats-picker">
                <div className="picker-year-grid">
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = now.getFullYear() - 4 + i;
                    return (
                      <button
                        key={y}
                        className={`picker-year-btn ${y === pickerYear ? 'selected' : ''}`}
                        onClick={() => selectYear(y)}
                      >
                        {y}년
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


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
                <p className="empty-message">{statsMonth + 1}월 운동 기록이 없습니다.</p>
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
