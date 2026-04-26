import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import workoutService from '../services/workoutService';
import { getThumbnail } from '../utils/r2Storage';
import type { Workout } from '../services/workoutService';
import raceService, { computePBIds } from '../services/raceService';
import type { RaceRecord } from '../services/raceService';
import { RaceRecordCard } from '../components/RaceRecordCard';
import { AddRaceModal } from '../components/AddRaceModal';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

type TabType = 'calendar' | 'list' | 'stats' | 'records';

const CATEGORY_GROUPS: Record<string, string> = { '러닝': '달리기', '트레드밀': '달리기' };
const getCatGroup = (category: string) => CATEGORY_GROUPS[category] || category;

export const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [distanceCategoryIdx, setDistanceCategoryIdx] = useState(0);
  const [raceRecords, setRaceRecords] = useState<RaceRecord[]>([]);
  const [raceLoading, setRaceLoading] = useState(false);
  const [showAddRace, setShowAddRace] = useState(false);
  const [editingRace, setEditingRace] = useState<RaceRecord | undefined>();

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
  const [chartMetric, setChartMetric] = useState<'workoutDays' | 'totalDistance'>('workoutDays');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  const calcMonthStats = (year: number, month: number) => {
    const monthWorkouts = workouts.filter((w) => {
      const d = new Date(w.workout_time);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const totalDistance = monthWorkouts.filter((w) => w.unit === 'km').reduce((s, w) => s + w.value, 0);
    const uniqueDays = new Set(monthWorkouts.map((w) => new Date(w.workout_time).toDateString())).size;
    const categoryCount: Record<string, number> = {};
    const distanceByGroup: Record<string, number> = {};
    const countByGroup: Record<string, number> = {};
    monthWorkouts.forEach((w) => {
      const label = getWorkoutLabel(w);
      categoryCount[label] = (categoryCount[label] || 0) + 1;
      const group = getCatGroup(w.category);
      countByGroup[group] = (countByGroup[group] || 0) + 1;
      if (w.unit === 'km') distanceByGroup[group] = (distanceByGroup[group] || 0) + w.value;
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

  const distanceCategories = Array.from(new Set(workouts.filter(w => w.unit === 'km').map(w => getCatGroup(w.category))));
  const selectedDistanceCat = distanceCategories[distanceCategoryIdx % Math.max(distanceCategories.length, 1)] ?? '';

  const stats = calcMonthStats(statsYear, statsMonth);
  const prevYear = statsMonth === 0 ? statsYear - 1 : statsYear;
  const prevMonth = statsMonth === 0 ? 11 : statsMonth - 1;
  const prevStats = calcMonthStats(prevYear, prevMonth);

  const METRIC_CONFIG = {
    workoutDays:   { label: '운동일수', unit: '일',  key: 'workoutDays'   as const },
    totalDistance: { label: '달린 거리', unit: 'km', key: 'totalDistance' as const },
  };

  const renderDiffBadge = (cur: number, prev: number, unit: string) => {
    const diff = +(cur - prev).toFixed(1);
    if (cur === 0 && prev === 0) return null;
    if (diff === 0) return <span className="diff-badge neutral">전달과 동일</span>;
    return (
      <span className={`diff-badge ${diff > 0 ? 'up' : 'down'}`}>
        {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}{unit}
      </span>
    );
  };

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
        <button
          className={`tab ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          🏅 기록실
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
                    const label = chartMetric === 'totalDistance' && selectedDistanceCat
                      ? selectedDistanceCat
                      : METRIC_CONFIG[chartMetric].label;
                    return [`${(+val).toFixed(chartMetric === 'totalDistance' ? 1 : 0)}${METRIC_CONFIG[chartMetric].unit}`, label];
                  }}
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }}
                  cursor={{ fill: 'rgba(79,195,247,0.08)' }}
                />
                <Bar
                  dataKey={chartMetric === 'totalDistance' && selectedDistanceCat
                    ? (d: any) => d.distanceByGroup?.[selectedDistanceCat] ?? 0
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
                {chartMetric === 'totalDistance' && (prevStats.distanceByGroup?.[selectedDistanceCat] ?? 0) > 0 && (
                  <>
                    <ReferenceLine
                      y={(prevStats.distanceByGroup[selectedDistanceCat]) * 1.1}
                      stroke="#FF6B9D"
                      strokeDasharray="4 3"
                      strokeOpacity={0.85}
                      label={{ value: '+10%', position: 'insideTopRight', fontSize: 10, fill: '#FF6B9D' }}
                    />
                    <ReferenceLine
                      y={(prevStats.distanceByGroup[selectedDistanceCat]) * 1.2}
                      stroke="#8B5CF6"
                      strokeDasharray="4 3"
                      strokeOpacity={0.85}
                      label={{ value: '+20%', position: 'insideTopRight', fontSize: 10, fill: '#8B5CF6' }}
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>

            {chartMetric === 'totalDistance' && distanceCategories.length > 1 && (
              <div className="chart-category-nav">
                <button className="cat-nav-btn" onClick={() => setDistanceCategoryIdx(i => (i - 1 + distanceCategories.length) % distanceCategories.length)}>‹</button>
                <span className="cat-nav-label">{selectedDistanceCat}</span>
                <button className="cat-nav-btn" onClick={() => setDistanceCategoryIdx(i => (i + 1) % distanceCategories.length)}>›</button>
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
          <div className="compare-cards">
            <div className="compare-card">
              <div className="compare-card-label">운동일수</div>
              <div className="compare-card-value">{stats.workoutDays}<span className="compare-unit">일</span></div>
              <div className="compare-card-prev">전달 {prevStats.workoutDays}일</div>
              {renderDiffBadge(stats.workoutDays, prevStats.workoutDays, '일')}
            </div>

            <div className="compare-card distance-card">
              <div className="compare-card-label">
                달린 거리
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
                return (
                  <>
                    <div className="compare-card-value">{cur}<span className="compare-unit">km</span></div>
                    <div className="compare-card-prev">전달 {prev}km</div>
                    {renderDiffBadge(cur, prev, 'km')}
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
                  const count = stats.countByGroup[group] ?? 0;
                  const maxVal = Math.max(dist, prevDist * 1.2, 0.1);
                  const fillPct = (dist / maxVal) * 100;
                  const prev100Pct = prevDist > 0 ? (prevDist / maxVal) * 100 : null;
                  const prev110Pct = prevDist > 0 ? (prevDist * 1.1 / maxVal) * 100 : null;
                  const achievePct = prevDist > 0 ? Math.round((dist / prevDist) * 100) : null;
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
                                {prevDist.toFixed(0)}km
                              </span>
                            )}
                            {prev110Pct !== null && (
                              <span className="cat-gauge-tick-lbl target110" style={{ left: `${prev110Pct}%` }}>
                                {(prevDist * 1.1).toFixed(0)}km
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="cat-gauge-bottom">
                        <span className="cat-gauge-record">{dist.toFixed(1)}km · {count}회</span>
                        {achievePct !== null && (
                          <span className={`cat-gauge-achieve ${achievePct >= 110 ? 'over' : achievePct >= 100 ? 'hit' : ''}`}>
                            전달대비 {achievePct}%
                          </span>
                        )}
                      </div>
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
                  />
                ))}
              </div>
            );
          })()}
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
    </div>
  );
};
