import { useState, useEffect } from 'react';
import { getAllLogs } from '../storage/supabaseStorage';
import type { WorkoutLog } from '../types';
import { 
  calculateAdjustedDistance, 
  mapToCardioCategory, 
  getCardioIcon, 
  getCardioCategoryName, 
  CARDIO_MULTIPLIERS,
  type CardioCategory 
} from '../features/parse/normalizeCardio';

// 상세 기록을 위한 데이터 구조 정의
interface CardioDetailItem {
  id: string;         // 고유 ID (Key용)
  date: string;       // 날짜 (2024-01-01)
  name: string;       // 운동명 (러닝, 사이클 등)
  rawDistance: number; // 실제 거리
  adjustedDistance: number; // 환산 거리
  duration: number | null; // 시간
  speed: number | null; // 속도
  pace: string | null; // 페이스
}

interface MonthlyStats {
  year: number;
  month: number;
  workoutDays: number;
  totalDistance: number; 
  totalCardioMinutes: number;
  avgPace: number; 

  // 카테고리별 합계
  distanceByCategory: Record<CardioCategory, number>;
  
  // 🔥 [핵심] 카테고리별 상세 기록 리스트 (Drill-down용 데이터)
  detailsByCategory: Record<CardioCategory, CardioDetailItem[]>;

  strengthDays: Set<string>;
  cardioDays: Set<string>;
  skillDays: Set<string>;
  flexibilityDays: Set<string>;
  coreDays: Set<string>;
  snowboardDays: Set<string>;
}

export const Dashboard = () => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  
  // 🔥 상세 모달 상태 관리 (선택된 카테고리가 있으면 모달 뜸)
  const [selectedCategory, setSelectedCategory] = useState<CardioCategory | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const allLogs = await getAllLogs();
    setLogs(allLogs);
    setLoading(false);
  };

  // 통계 계산 로직 (한 번의 루프로 모든 데이터 정리)
  const calculateMonthlyStats = (): MonthlyStats => {
    const stats: MonthlyStats = {
      year: selectedYear,
      month: selectedMonth,
      workoutDays: 0,
      totalDistance: 0,
      totalCardioMinutes: 0,
      avgPace: 0,
      
      distanceByCategory: { running: 0, stepmill: 0, rowing: 0, cycle: 0, other: 0 },
      // 상세 데이터 배열 초기화
      detailsByCategory: { running: [], stepmill: [], rowing: [], cycle: [], other: [] },

      strengthDays: new Set<string>(),
      cardioDays: new Set<string>(),
      skillDays: new Set<string>(),
      flexibilityDays: new Set<string>(),
      coreDays: new Set<string>(),
      snowboardDays: new Set<string>(),
    };

    const workoutDates = new Set<string>();

    logs.forEach((log) => {
      const logDate = new Date(log.date);
      // 선택된 연/월 데이터만 필터링
      if (logDate.getFullYear() === selectedYear && logDate.getMonth() + 1 === selectedMonth) {
        workoutDates.add(log.date);

        log.workouts.forEach((workout, index) => {
          // 1. 기본 통계용 Set 추가
          if (workout.type === 'strength') stats.strengthDays.add(log.date);
          if (workout.type === 'cardio') stats.cardioDays.add(log.date);
          if (workout.type === 'skill') stats.skillDays.add(log.date);
          if (workout.type === 'flexibility') stats.flexibilityDays.add(log.date);
          if (workout.type === 'strength' && workout.target === 'core') stats.coreDays.add(log.date);
          if (workout.category === 'snowboard') stats.snowboardDays.add(log.date);

          // 2. 유산소 데이터 상세 집계
          if (workout.type === 'cardio') {
            const rawDist = workout.distance_km || 0;
            const adjustedDist = calculateAdjustedDistance(
              workout.distance_km,
              workout.adjusted_dist_km ?? null,
              workout.name
            );

            // 총합 누적
            stats.totalDistance += adjustedDist;

            // 카테고리 판별
            const category = mapToCardioCategory(workout.name);
            
            // 카테고리별 합계 누적
            if (stats.distanceByCategory[category] !== undefined) {
              stats.distanceByCategory[category] += adjustedDist;
            } else {
              stats.distanceByCategory['other'] += adjustedDist;
            }

            // 🔥 [상세 데이터 저장] 리스트에 항목 추가 (Drill-down용)
            const detailItem: CardioDetailItem = {
              id: `${log.id}-${index}`, // 고유 키 생성
              date: log.date,
              name: workout.name,
              rawDistance: rawDist,
              adjustedDistance: adjustedDist,
              duration: workout.duration_min || null,
              speed: workout.speed_kph || null,
              pace: workout.pace || null
            };

            // 해당 카테고리 배열에 push
            if (stats.detailsByCategory[category]) {
              stats.detailsByCategory[category].push(detailItem);
            } else {
              stats.detailsByCategory['other'].push(detailItem);
            }

            if (workout.duration_min) {
              stats.totalCardioMinutes += workout.duration_min;
            }
          }
        });
      }
    });

    stats.workoutDays = workoutDates.size;
    if (stats.totalDistance > 0) {
      stats.avgPace = stats.totalCardioMinutes / stats.totalDistance;
    }

    return stats;
  };

  const generateCalendar = () => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); 

    const calendar: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) calendar.push(null);
    for (let day = 1; day <= daysInMonth; day++) calendar.push(day);
    return calendar;
  };

  const getWorkoutTypesForDate = (day: number): Set<string> => {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const types = new Set<string>();
    logs.forEach((log) => {
      if (log.date === dateStr) {
        log.workouts.forEach((workout) => {
          types.add(workout.type);
          if (workout.type === 'strength' && workout.target === 'core') types.add('core');
          if (workout.category === 'snowboard') types.add('snowboard');
        });
      }
    });
    return types;
  };

  const stats = calculateMonthlyStats();
  const calendar = generateCalendar();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else { setSelectedMonth(selectedMonth - 1); }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else { setSelectedMonth(selectedMonth + 1); }
  };

  if (loading) {
    return <div className="container"><div className="loading-screen">데이터 로딩 중...</div></div>;
  }

  // 차트용 데이터 정렬 (거리순)
  const sortedCategories = (Object.keys(stats.distanceByCategory) as CardioCategory[])
    .map(category => ({
      category,
      distance: stats.distanceByCategory[category]
    }))
    .filter(item => item.distance > 0)
    .sort((a, b) => b.distance - a.distance);

  return (
    <div className="container" style={{ position: 'relative' }}>
      <div className="header">
        <h1>대시보드</h1>
      </div>

      <div className="month-selector">
        <button className="month-nav-button" onClick={handlePrevMonth}>←</button>
        <div className="month-display">{selectedYear}년 {selectedMonth}월</div>
        <button className="month-nav-button" onClick={handleNextMonth}>→</button>
      </div>

      <div className="stats-section">
        <h2>월간 리포트</h2>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">운동 일수</div>
            <div className="stat-value">{stats.workoutDays}일</div>
          </div>

          {/* 🔥 유산소 거리 카드 */}
          <div className="stat-card" style={{ gridRow: 'span 2' }}>
            <div className="stat-label">유산소 환산 거리</div>
            <div className="stat-value" style={{ marginBottom: '16px' }}>
              {stats.totalDistance.toFixed(1)} <span style={{fontSize: '16px'}}>km</span>
            </div>
            
            {/* 카테고리별 요약 리스트 (클릭 가능) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedCategories.length > 0 ? (
                sortedCategories.map(({ category, distance }) => (
                  <div 
                    key={category} 
                    onClick={() => setSelectedCategory(category)} // 🔥 클릭 시 모달 오픈
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--input-bg)',
                      border: '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{getCardioIcon(category)}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>
                          {getCardioCategoryName(category)}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          가중치 ×{CARDIO_MULTIPLIERS[category]}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {distance.toFixed(1)} km
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>›</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '12px', color: '#ccc', textAlign: 'center' }}>
                  기록 없음
                </div>
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">평균 페이스</div>
            <div className="stat-value">
              {stats.avgPace > 0 ? `${stats.avgPace.toFixed(1)} 분/km` : '-'}
            </div>
          </div>
        </div>

        <div className="type-stats">
          <div className="type-stat-item"><span className="type-badge strength">근력</span><span>{stats.strengthDays.size}일</span></div>
          <div className="type-stat-item"><span className="type-badge cardio">유산소</span><span>{stats.cardioDays.size}일</span></div>
          <div className="type-stat-item"><span className="type-badge core">코어</span><span>{stats.coreDays.size}일</span></div>
          <div className="type-stat-item"><span className="type-badge snowboard">스노보드</span><span>{stats.snowboardDays.size}일</span></div>
        </div>
      </div>

      <div className="calendar-section">
        <h2>운동 캘린더</h2>
        <div className="calendar-grid">
          {weekdays.map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
          {calendar.map((day, index) => {
            if (day === null) return <div key={`empty-${index}`} className="calendar-day empty"></div>;
            const types = getWorkoutTypesForDate(day);
            const hasWorkout = types.size > 0;
            return (
              <div key={day} className={`calendar-day ${hasWorkout ? 'has-workout' : ''}`}>
                <div className="day-number">{day}</div>
                {hasWorkout && (
                  <div className="workout-indicators">
                    {types.has('strength') && <div className="indicator strength"></div>}
                    {types.has('cardio') && <div className="indicator cardio"></div>}
                    {types.has('core') && <div className="indicator core"></div>}
                    {types.has('snowboard') && <div className="indicator snowboard"></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 🔥 [상세 분석 모달] - 선택된 카테고리의 상세 기록 표시 */}
      {selectedCategory && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setSelectedCategory(null)}
        >
          <div 
            style={{
              backgroundColor: 'var(--card-bg)',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              animation: 'slideUp 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div style={{ 
              padding: '20px', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{getCardioIcon(selectedCategory)}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {getCardioCategoryName(selectedCategory)} 상세 기록
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {selectedYear}년 {selectedMonth}월 • 총 {stats.distanceByCategory[selectedCategory].toFixed(1)}km (환산)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCategory(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            {/* 모달 바디 (스크롤 가능한 테이블) */}
            <div style={{ overflowY: 'auto', padding: '0' }}>
              {stats.detailsByCategory[selectedCategory].length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', width: '30%' }}>날짜</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: '600', width: '35%' }}>내용</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: '600', width: '35%' }}>거리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.detailsByCategory[selectedCategory]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // 최신순 정렬
                      .map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.date.slice(5)}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {item.duration ? `${item.duration}분` : '-'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{color: 'var(--text-primary)'}}>{item.name}</div>
                          {(item.speed || item.pace) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {item.speed ? `${item.speed}km/h` : ''} {item.pace ? `(${item.pace})` : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                            {item.adjustedDistance.toFixed(1)} <span style={{fontSize: '11px'}}>km</span>
                          </div>
                          {item.rawDistance !== item.adjustedDistance && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textDecoration: 'line-through', marginTop: '2px' }}>
                              (실 {item.rawDistance.toFixed(1)})
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  기록이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};