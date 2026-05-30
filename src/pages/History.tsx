import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WorkoutDetail } from './WorkoutDetail';
import workoutService from '../services/workoutService';
import { getThumbnail } from '../utils/r2Storage';
import type { Workout } from '../services/workoutService';
import raceService, { computePBIds } from '../services/raceService';
import type { RaceRecord } from '../services/raceService';
import { RaceRecordCard } from '../components/RaceRecordCard';
import { AddRaceModal } from '../components/AddRaceModal';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

type TabType = 'calendar' | 'list' | 'stats' | 'records';

const CATEGORY_GROUPS: Record<string, string> = { '러닝': '달리기', '트레드밀': '달리기' };

const DISTANCE_MILESTONES = [
  { km: 15,  label: '서울→수원' },
  { km: 90,  label: '서울→천안' },
  { km: 140, label: '서울→대전' },
  { km: 240, label: '서울→대구' },
  { km: 400, label: '서울→부산' },
  { km: 700, label: '한반도 종단' },
];

const getMilestoneProgress = (km: number) => {
  const passed   = DISTANCE_MILESTONES.filter((m) => km >= m.km);
  const upcoming = DISTANCE_MILESTONES.filter((m) => km <  m.km);
  const current  = passed.at(-1) ?? null;
  const next     = upcoming[0]   ?? null;
  const fromKm   = current?.km ?? 0;
  const pct      = next ? Math.min(Math.round(((km - fromKm) / (next.km - fromKm)) * 100), 99) : 100;
  return { current, next, pct };
};
const getCatGroup = (category: string) => CATEGORY_GROUPS[category] || category;

export const History = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [distanceCategoryIdx, setDistanceCategoryIdx] = useState(0);
  const [raceRecords, setRaceRecords] = useState<RaceRecord[]>([]);
  const [raceLoading, setRaceLoading] = useState(false);
  const [showAddRace, setShowAddRace] = useState(false);
  const [editingRace, setEditingRace] = useState<RaceRecord | undefined>();
  const [viewingRace, setViewingRace] = useState<RaceRecord | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

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

  const loadRaceRecords = async () => {
    if (!user) return;
    setRaceLoading(true);
    try {
      const data = await raceService.getRecordsByUserId(user.id);
      setRaceRecords(data);
    } catch (e) {
      console.error('기록실 불러오기 실패:', e);
    } finally {
      setRaceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'records') loadRaceRecords();
  }, [activeTab, user]);

  const handleDeleteRace = async (id: string) => {
    if (!confirm('이 기록을 삭제할까요?')) return;
    await raceService.deleteRecord(id);
    setRaceRecords(prev => prev.filter(r => r.id !== id));
  };

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
    if (workout.category === '복싱') {
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

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const getCalendarMonthWorkoutDays = (baseDate: Date) => {
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const days = workouts.filter((w) => {
      const d = new Date(w.workout_time);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    return new Set(days.map((w) => new Date(w.workout_time).toDateString())).size;
  };

  const now = new Date();
  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [statsMonth, setStatsMonth] = useState(now.getMonth());
  const [chartMetric, setChartMetric] = useState<'workoutDays' | 'totalDistance'>('workoutDays');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  const calcMonthStats = (year: number, month: number) => {
    const monthWorkouts = workouts.filter((w) => {
      const d = new Date(w.workout_time);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const totalDistance = monthWorkouts.filter((w) => w.unit === 'km' || w.unit === 'm').reduce((s, w) => s + (w.unit === 'm' ? w.value / 1000 : w.value), 0);
    const uniqueDays = new Set(monthWorkouts.map((w) => new Date(w.workout_time).toDateString())).size;
    const categoryCount: Record<string, number> = {};
    const distanceByGroup: Record<string, number> = {};
    const countByGroup: Record<string, number> = {};
    monthWorkouts.forEach((w) => {
      const label = getWorkoutLabel(w);
      categoryCount[label] = (categoryCount[label] || 0) + 1;
      const group = getCatGroup(w.category);
      countByGroup[group] = (countByGroup[group] || 0) + 1;
      if (w.unit === 'km' || w.unit === 'm') {
        const distKm = w.unit === 'm' ? w.value / 1000 : w.value;
        distanceByGroup[group] = (distanceByGroup[group] || 0) + distKm;
      }
    });
    return { totalWorkouts: monthWorkouts.length, totalDistance, workoutDays: uniqueDays, categoryCount, distanceByGroup, countByGroup };
  };

  // 최근 6개월 차트 데이터
  const chartData = Array.from({ length: 6 }, (_, i) => {
    let y = now.getFullYear();
    let m = now.getMonth() - 5 + i;
    if (m < 0) { m += 12; y -= 1; }
    const s = calcMonthStats(y, m);
    return { label: `${m + 1}월`, year: y, month: m, ...s };
  });

  const distanceCategories = Array.from(new Set(workouts.filter(w => w.unit === 'km' || w.unit === 'm').map(w => getCatGroup(w.category))));
  const selectedDistanceCat = distanceCategories[distanceCategoryIdx % Math.max(distanceCategories.length, 1)] ?? '';

  const allCategories = Array.from(new Set(workouts.map(w => getCatGroup(w.category))));
  const [chartCategoryIdx, setChartCategoryIdx] = useState(0);
  const selectedChartCat = allCategories[chartCategoryIdx % Math.max(allCategories.length, 1)] ?? '';

  const stats = calcMonthStats(statsYear, statsMonth);
  const prevYear = statsMonth === 0 ? statsYear - 1 : statsYear;
  const prevMonth = statsMonth === 0 ? 11 : statsMonth - 1;
  const prevStats = calcMonthStats(prevYear, prevMonth);

  // 페이스 비교: 지난달 일평균 × 경과일수 기준
  const isCurrentMonth = statsYear === now.getFullYear() && statsMonth === now.getMonth();
  const elapsedDays = isCurrentMonth ? now.getDate() : new Date(statsYear, statsMonth + 1, 0).getDate();
  const prevMonthDays = new Date(prevYear, prevMonth + 1, 0).getDate();
  const calcPaceTarget = (prevVal: number) => prevVal > 0 ? (prevVal / prevMonthDays) * elapsedDays : 0;
  const calcPacePct = (cur: number, prevVal: number) => {
    const target = calcPaceTarget(prevVal);
    if (target === 0) return null;
    return Math.round((cur / target) * 100);
  };

  const [showPaceInfo, setShowPaceInfo] = useState(false);

  const METRIC_CONFIG = {
    workoutDays:   { label: '운동일수', unit: '일' },
    totalDistance: { label: '종목별',   unit: '회' },
  };

  const renderPaceBadge = (pct: number | null) => {
    if (pct === null) return null;
    if (pct === 100) return <span className="diff-badge neutral">지난달 페이스와 동일</span>;
    return (
      <span className={`diff-badge ${pct > 100 ? 'up' : 'down'}`}>
        {pct > 100 ? `▲ +${pct - 100}%` : `▼ -${100 - pct}%`}
      </span>
    );
  };

  return (
    <div className="container">
      {/* 탭 */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          캘린더
        </button>
        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          리스트
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          통계
        </button>
        <button
          className={`tab ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          기록실
        </button>
      </div>

      {/* 캘린더 탭 */}
      {activeTab === 'calendar' && (
        <div className="tab-content">
          <div className="calendar-container">
            <div className="calendar-month-summary">
              <div className="calendar-month-nav">
                <button
                  className="calendar-nav-btn"
                  onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                >‹</button>
                <span className="calendar-month-label">
                  {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
                </span>
                <button
                  className="calendar-nav-btn"
                  onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  disabled={
                    calendarMonth.getFullYear() === now.getFullYear() &&
                    calendarMonth.getMonth() === now.getMonth()
                  }
                >›</button>
              </div>
              <span className="calendar-workout-days-badge">
                운동 <strong>{getCalendarMonthWorkoutDays(calendarMonth)}</strong>일
              </span>
            </div>
            <Calendar
              locale="ko-KR"
              calendarType="gregory"
              activeStartDate={calendarMonth}
              tileClassName={({ date }) => {
                const classes: string[] = [];
                if (hasWorkoutOnDate(date)) classes.push('has-workout');
                if (date.getDay() === 0) classes.push('is-sunday');
                if (date.getDay() === 6) classes.push('is-saturday');
                return classes.join(' ') || null;
              }}
              onClickDay={(date) => setSelectedDate(date)}
              onActiveStartDateChange={({ activeStartDate }) => {
                if (activeStartDate) setCalendarMonth(activeStartDate);
              }}
              formatDay={(_locale, date) => String(date.getDate())}
              showNeighboringMonth={false}
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
                      onClick={() => setSelectedWorkout(workout)}
                    >
                      <div className="workout-item-content">
                        <div className="workout-item-left">
                          <div className="workout-type-badge">
                            {getWorkoutLabel(workout)}
                          </div>
                          <div className="workout-distance">
                            {workout.value}{workout.unit}
                          </div>
                        </div>
                        <div className="workout-item-right">
                          <div className="workout-date" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {workout.source === 'strava' && (
                              <img src="https://cdn.simpleicons.org/strava/FC4C02" alt="Strava" style={{ width: 12, height: 12 }} />
                            )}
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
                  onClick={() => setSelectedWorkout(workout)}
                >
                  <div className="workout-item-content">
                    <div className="workout-item-left">
                      <div className="workout-type-badge">
                        {getWorkoutLabel(workout)}
                      </div>
                      <div className="workout-distance">
                        {workout.value}{workout.unit}
                      </div>
                    </div>
                    <div className="workout-item-right">
                      <div className="workout-date" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {workout.source === 'strava' && (
                          <img src="https://cdn.simpleicons.org/strava/FC4C02" alt="Strava" style={{ width: 12, height: 12 }} />
                        )}
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
        <div className="tab-content stats-tab">

          {/* ── 차트 섹션 ── */}
          <div className="stats-chart-section">
            <div className="stats-chart-header">
              <span className="stats-chart-title">최근 6개월 추이</span>
              <div className="chart-metric-tabs">
                {(Object.keys(METRIC_CONFIG) as (keyof typeof METRIC_CONFIG)[]).map((k) => (
                  <button
                    key={k}
                    className={`chart-metric-btn ${chartMetric === k ? 'active' : ''}`}
                    onClick={() => setChartMetric(k)}
                  >
                    {METRIC_CONFIG[k].label}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(val: any) => {
                    const tooltipLabel = chartMetric === 'totalDistance' ? selectedChartCat : METRIC_CONFIG[chartMetric].label;
                    return [`${Math.round(+val)}${METRIC_CONFIG[chartMetric].unit}`, tooltipLabel];
                  }}
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }}
                  cursor={{ fill: 'rgba(79,195,247,0.08)' }}
                />
                <Bar
                  dataKey={chartMetric === 'totalDistance'
                    ? (d: any) => d.countByGroup?.[selectedChartCat] ?? 0
                    : (chartMetric as string)}
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(data: any) => {
                    if (data?.year !== undefined && data?.month !== undefined) {
                      setStatsYear(data.year);
                      setStatsMonth(data.month);
                    }
                  }}
                >
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.year === statsYear && entry.month === statsMonth ? '#FF6B9D' : '#4FC3F7'}
                      opacity={entry.year === statsYear && entry.month === statsMonth ? 0.85 : 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {chartMetric === 'totalDistance' && allCategories.length > 1 && (
              <div className="chart-category-nav">
                <button className="cat-nav-btn" onClick={() => setChartCategoryIdx(i => (i - 1 + allCategories.length) % allCategories.length)}>‹</button>
                <span className="cat-nav-label">{selectedChartCat}</span>
                <button className="cat-nav-btn" onClick={() => setChartCategoryIdx(i => (i + 1) % allCategories.length)}>›</button>
              </div>
            )}

            <p className="chart-hint">막대를 누르면 해당 월로 이동</p>
          </div>

          {/* ── 선택 월 헤더 ── */}
          <div className="stats-month-nav">
            <button className="month-nav-btn" onClick={() => {
              setShowPicker(false);
              if (statsMonth === 0) { setStatsYear(y => y - 1); setStatsMonth(11); }
              else setStatsMonth(m => m - 1);
            }}>‹</button>
            <span className="month-nav-label" onClick={() => {
              setPickerYear(statsYear);
              setShowPicker(v => !v);
            }}>{statsYear}년 {statsMonth + 1}월</span>
            <button className="month-nav-btn" onClick={() => {
              setShowPicker(false);
              const isCur = statsYear === now.getFullYear() && statsMonth === now.getMonth();
              if (isCur) return;
              if (statsMonth === 11) { setStatsYear(y => y + 1); setStatsMonth(0); }
              else setStatsMonth(m => m + 1);
            }} disabled={statsYear === now.getFullYear() && statsMonth === now.getMonth()}>›</button>
          </div>

          {/* ── 년월 피커 ── */}
          {showPicker && (
            <div className="stats-picker">
              <div className="picker-year-row">
                <button className="month-nav-btn" onClick={() => setPickerYear(y => y - 1)}>‹</button>
                <span style={{ fontWeight: 700, fontSize: 16, minWidth: 60, textAlign: 'center' }}>{pickerYear}년</span>
                <button className="month-nav-btn" onClick={() => setPickerYear(y => y + 1)}
                  disabled={pickerYear >= now.getFullYear()}>›</button>
              </div>
              <div className="picker-month-grid">
                {Array.from({ length: 12 }, (_, i) => {
                  const isFuture = pickerYear === now.getFullYear() && i > now.getMonth();
                  const isSelected = pickerYear === statsYear && i === statsMonth;
                  return (
                    <button
                      key={i}
                      className={`picker-month-btn${isSelected ? ' selected' : ''}`}
                      disabled={isFuture}
                      onClick={() => {
                        setStatsYear(pickerYear);
                        setStatsMonth(i);
                        setShowPicker(false);
                      }}
                    >
                      {i + 1}월
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 비교 카드 ── */}
          <div className="compare-cards-header">
            <span className="compare-cards-title">지난달 페이스 비교</span>
            <button className="pace-info-btn" onClick={() => setShowPaceInfo(v => !v)}>ⓘ</button>
          </div>
          {showPaceInfo && (
            <div className="pace-info-overlay" onClick={() => setShowPaceInfo(false)}>
              <div className="pace-info-panel" onClick={e => e.stopPropagation()}>
                <div className="pace-info-handle" />
                <div className="pace-info-header">
                  <span className="pace-info-title">지난달 페이스 비교</span>
                  <button className="pace-info-close" onClick={() => setShowPaceInfo(false)}>✕</button>
                </div>
                <p>지난달 하루 평균 × {isCurrentMonth ? `이번 달 경과 ${elapsedDays}일` : `해당 월 전체 ${elapsedDays}일`}을 기준으로, 지금까지의 페이스가 지난달과 비교해 몇 %인지를 보여줍니다.</p>
                {prevStats.workoutDays > 0 && (
                  <p className="pace-info-example">
                    예) 지난달 운동일수 {prevStats.workoutDays}일 ({prevMonthDays}일 기준) → 하루 평균 {(prevStats.workoutDays / prevMonthDays).toFixed(2)}일 · {elapsedDays}일 기준 {(calcPaceTarget(prevStats.workoutDays)).toFixed(1)}일이 기준점
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="compare-cards">
            <div className="compare-card">
              <div className="compare-card-label">운동일수</div>
              <div className="compare-card-value">{stats.workoutDays}<span className="compare-unit">일</span></div>
              <div className="compare-card-prev">지난달 {elapsedDays}일 기준 {calcPaceTarget(prevStats.workoutDays).toFixed(1)}일</div>
              {renderPaceBadge(calcPacePct(stats.workoutDays, prevStats.workoutDays))}
            </div>

            <div className="compare-card distance-card">
              <div className="compare-card-label">
                이동 거리
                {distanceCategories.length > 1 && (
                  <div className="distance-card-nav">
                    <button onClick={() => setDistanceCategoryIdx(i => (i - 1 + distanceCategories.length) % distanceCategories.length)}>‹</button>
                    <span>{selectedDistanceCat}</span>
                    <button onClick={() => setDistanceCategoryIdx(i => (i + 1) % distanceCategories.length)}>›</button>
                  </div>
                )}
                {distanceCategories.length === 1 && selectedDistanceCat && (
                  <span className="distance-cat-badge">{selectedDistanceCat}</span>
                )}
              </div>
              {(() => {
                const cur = +(stats.distanceByGroup[selectedDistanceCat] ?? 0).toFixed(1);
                const prev = +(prevStats.distanceByGroup[selectedDistanceCat] ?? 0).toFixed(1);
                const target = +calcPaceTarget(prev).toFixed(1);
                return (
                  <>
                    <div className="compare-card-value">{cur}<span className="compare-unit">km</span></div>
                    <div className="compare-card-prev">지난달 {elapsedDays}일 기준 {target}km</div>
                    {renderPaceBadge(calcPacePct(cur, prev))}
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── 종목별 거리 ── */}
          {Object.keys(stats.distanceByGroup).length > 0 && (
            <div className="category-chart-section">
              <h4 className="category-chart-title">종목별 거리</h4>
              {Object.entries(stats.distanceByGroup)
                .filter(([, d]) => d > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([group, dist]) => {
                  const prevDist = prevStats.distanceByGroup[group] ?? 0;
                  const paceTarget = +calcPaceTarget(prevDist).toFixed(1);
                  const count = stats.countByGroup[group] ?? 0;
                  const maxVal = Math.max(dist, paceTarget * 1.2, 0.1);
                  const fillPct = (dist / maxVal) * 100;
                  const prev100Pct = paceTarget > 0 ? (paceTarget / maxVal) * 100 : null;
                  const prev110Pct = paceTarget > 0 ? (paceTarget * 1.1 / maxVal) * 100 : null;
                  const achievePct = calcPacePct(dist, prevDist);
                  return (
                    <div key={group} className="cat-gauge-row">
                      <span className="cat-gauge-name">{group}</span>
                      <div className="cat-gauge-outer">
                        <div className="cat-gauge-track">
                          <div className="cat-gauge-fill" style={{ width: `${Math.min(fillPct, 100)}%` }} />
                        </div>
                        {prev100Pct !== null && (
                          <div className="cat-gauge-tick-mark" style={{ left: `${prev100Pct}%` }} />
                        )}
                        {prev110Pct !== null && (
                          <div className="cat-gauge-tick-mark target110" style={{ left: `${prev110Pct}%` }} />
                        )}
                        {(prev100Pct !== null || prev110Pct !== null) && (
                          <div className="cat-gauge-tick-labels">
                            {prev100Pct !== null && (
                              <span className="cat-gauge-tick-lbl" style={{ left: `${prev100Pct}%` }}>
                                {paceTarget.toFixed(0)}km
                              </span>
                            )}
                            {prev110Pct !== null && (
                              <span className="cat-gauge-tick-lbl target110" style={{ left: `${prev110Pct}%` }}>
                                {(paceTarget * 1.1).toFixed(0)}km
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="cat-gauge-bottom">
                        <span className="cat-gauge-record">{dist.toFixed(1)}km · {count}회</span>
                        {achievePct !== null && (
                          <span className={`cat-gauge-achieve ${achievePct >= 110 ? 'over' : achievePct >= 100 ? 'hit' : ''}`}>
                            지난달대비 {achievePct >= 100 ? `+${achievePct - 100}` : `-${100 - achievePct}`}%
                          </span>
                        )}
                      </div>
                      {(() => {
                        const { current, next, pct } = getMilestoneProgress(dist);
                        if (!next && !current) return null;
                        return (
                          <div className="cat-gauge-milestone">
                            <div className="milestone-bar-track">
                              <div className="milestone-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="milestone-label-inline">
                              {next ? (
                                <>
                                  <span className="milestone-dest">{next.label} ({next.km}km)</span>까지&nbsp;
                                  <strong>{pct}%</strong>
                                  {current && <span className="milestone-prev"> · {current.label} ✓</span>}
                                </>
                              ) : (
                                <span className="milestone-complete">한반도 종단 달성! 🎉</span>
                              )}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
            </div>
          )}

          {stats.totalWorkouts === 0 && (
            <p className="empty-message" style={{ textAlign: 'center', marginTop: 24 }}>
              {statsMonth + 1}월 운동 기록이 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 기록실 탭 */}
      {activeTab === 'records' && user && (
        <div className="tab-content">
          <div className="records-header">
            <span className="records-count">{raceRecords.length}개의 대회 기록</span>
            <button className="records-add-btn" onClick={() => { setEditingRace(undefined); setShowAddRace(true); }}>
              + 추가
            </button>
          </div>

          {raceLoading ? (
            <div className="loading-screen"><div className="spinner" /><p>불러오는 중...</p></div>
          ) : raceRecords.length === 0 ? (
            <div className="records-empty">
              <p>아직 대회 기록이 없습니다.</p>
              <p>첫 대회 기록을 추가해보세요!</p>
            </div>
          ) : (() => {
            const pbIds = computePBIds(raceRecords);
            return (
              <div className="race-list">
                {raceRecords.map(r => (
                  <RaceRecordCard
                    key={r.id}
                    record={r}
                    isPB={pbIds.has(r.id)}
                    onDelete={handleDeleteRace}
                    onEdit={(rec) => { setEditingRace(rec); setShowAddRace(true); }}
                    onView={(rec) => setViewingRace(rec)}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {viewingRace && (
        <div className="race-detail-overlay" onClick={() => setViewingRace(null)}>
          <div className="race-detail-sheet" onClick={e => e.stopPropagation()}>
            <div className="race-detail-handle" />

            <div className="race-detail-header">
              <div className="race-detail-title-row">
                <span className="race-detail-name">{viewingRace.race_name}</span>
                {viewingRace.link_url && (
                  <a href={viewingRace.link_url} target="_blank" rel="noopener noreferrer" className="race-link-btn">
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
              <span className="race-detail-date">
                {(() => { const d = new Date(viewingRace.race_date); return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}`; })()}
                <span className="race-cat-badge" style={{ marginLeft: 8 }}>{viewingRace.category}</span>
              </span>
            </div>

            <div className="race-detail-time">{viewingRace.finish_time}</div>

            {viewingRace.image_url && (
              <div className="race-image-wrap">
                <img src={getThumbnail(viewingRace.image_url, 600, 300)} alt="대회 인증" />
              </div>
            )}

            {viewingRace.notes && <p className="race-notes">{viewingRace.notes}</p>}

            <div className="race-detail-actions">
              <button
                className="race-detail-edit-btn"
                onClick={() => { setViewingRace(null); setEditingRace(viewingRace); setShowAddRace(true); }}
              >
                <Pencil size={15} /> 수정
              </button>
              <button
                className="race-detail-delete-btn"
                onClick={() => { setViewingRace(null); handleDeleteRace(viewingRace.id); }}
              >
                <Trash2 size={15} /> 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddRace && user && (
        <AddRaceModal
          userId={user.id}
          record={editingRace}
          onClose={() => setShowAddRace(false)}
          onSaved={() => { setShowAddRace(false); loadRaceRecords(); }}
        />
      )}

      {selectedWorkout && (
        <WorkoutDetail
          workoutData={selectedWorkout}
          onClose={(changed) => {
            setSelectedWorkout(null);
            if (changed) loadWorkouts();
          }}
        />
      )}
    </div>
  );
};
