import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { ChevronLeft, Search, TrendingUp, Calendar } from 'lucide-react';
import clubService from '../services/clubService';
import type { ClubGrowthRow } from '../services/clubService';

type SortKey = 'growth_rate' | 'workout_days';

export const ClubGrowthDashboard = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<ClubGrowthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('growth_rate');

  useEffect(() => {
    if (clubId) load();
  }, [clubId, year, month]);

  const load = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const data = await clubService.getClubGrowthStats(clubId, year, month);
      setRows(data);
    } catch (e) {
      console.error('성장률 대시보드 로딩 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const isNow = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isNow) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const nameOf = (r: ClubGrowthRow) => r.club_nickname || r.display_name;

  const filtered = rows
    .filter(r => nameOf(r).includes(search))
    .sort((a, b) => {
      if (sortKey === 'growth_rate') {
        if (a.growth_rate === null && b.growth_rate === null) return 0;
        if (a.growth_rate === null) return 1;
        if (b.growth_rate === null) return -1;
        return b.growth_rate - a.growth_rate;
      }
      return b.workout_days - a.workout_days;
    });

  const rateColor = (rate: number | null) => {
    if (rate === null) return 'var(--text-secondary)';
    if (rate > 0) return '#22c55e';
    if (rate < 0) return '#ef4444';
    return 'var(--text-secondary)';
  };

  const rateLabel = (rate: number | null) => {
    if (rate === null) return '신규';
    const sign = rate > 0 ? '+' : '';
    return `${sign}${rate.toFixed(1)}%`;
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>이달의 성장</h1>
        </div>
      </div>

      {/* 월 선택 + 정렬 */}
      <div className="growth-dash-controls" style={{ padding: '0 16px' }}>
        <div className="growth-dash-month">
          <button className="growth-dash-arrow" onClick={prevMonth}>‹</button>
          <span className="growth-dash-month-label">{year}년 {month}월</span>
          <button className="growth-dash-arrow" onClick={nextMonth} disabled={isCurrentMonth}>›</button>
        </div>
        <div className="growth-dash-sort">
          <button
            className={`growth-dash-sort-btn${sortKey === 'growth_rate' ? ' active' : ''}`}
            onClick={() => setSortKey('growth_rate')}
          >
            <TrendingUp size={13} /> 성장률
          </button>
          <button
            className={`growth-dash-sort-btn${sortKey === 'workout_days' ? ' active' : ''}`}
            onClick={() => setSortKey('workout_days')}
          >
            <Calendar size={13} /> 운동일수
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="growth-dash-search" style={{ margin: '0 16px' }}>
        <Search size={14} className="growth-dash-search-icon" />
        <input
          className="growth-dash-search-input"
          placeholder="이름 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* 카드 목록 */}
      <div style={{ padding: '0 16px 80px' }}>
        {loading ? (
          <div className="growth-dash-empty">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="growth-dash-empty">데이터가 없습니다</div>
        ) : (
          filtered.map((row, idx) => (
            <div key={row.user_id} className="growth-card">
              <div className="growth-card-left">
                <div className="growth-card-rank">{idx + 1}</div>
                <div className="growth-card-avatar">
                  {row.profile_image?.startsWith('default:')
                    ? <div className="growth-card-avatar-default" style={{ background: row.profile_image.replace('default:', '') }}>{nameOf(row)[0]}</div>
                    : row.profile_image
                      ? <img src={row.profile_image} alt={nameOf(row)} />
                      : <span>{nameOf(row)[0]}</span>
                  }
                </div>
              </div>
              <div className="growth-card-info">
                <div className="growth-card-name-row">
                  <span className="growth-card-name">{nameOf(row)}</span>
                  <span
                    className="growth-card-rate"
                    style={{ color: rateColor(row.growth_rate) }}
                  >
                    {rateLabel(row.growth_rate)}
                  </span>
                </div>
                <div className="growth-card-row">
                  <span className="growth-card-label">마일리지</span>
                  <span className="growth-card-compare">
                    {row.prev_normalized !== null
                      ? `전달 ${row.elapsed_days}일분 ${row.prev_normalized}`
                      : '전달 없음'}
                    {' → '}
                    <strong>{row.curr_mileage.toFixed(1)}</strong>
                  </span>
                </div>
                <div className="growth-card-row">
                  <span className="growth-card-label">운동일수</span>
                  <span className="growth-card-compare">
                    {row.prev_workout_days_norm !== null
                      ? `전달 ${row.elapsed_days}일분 ${row.prev_workout_days_norm}일`
                      : '전달 없음'}
                    {' → '}
                    <strong>{row.workout_days}일</strong>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
