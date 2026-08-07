import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { ChevronLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import clubService from '../services/clubService';
import type { ClubMonthlySummary } from '../services/clubService';

const CATEGORY_COLORS: Record<string, string> = {
  '러닝': '#3b82f6',
  '수영': '#06b6d4',
  '자전거': '#f59e0b',
  '요가': '#8b5cf6',
  '복싱': '#ef4444',
  '등산': '#22c55e',
  '헬스': '#ec4899',
  '기타': '#94a3b8',
};

const categoryColor = (cat: string) => CATEGORY_COLORS[cat] ?? '#94a3b8';

const CHART_HEIGHT = 200;

export const ClubStatsPage = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();

  const [monthRange, setMonthRange] = useState<3 | 6>(6);
  const [summary, setSummary] = useState<ClubMonthlySummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    clubService.getClubMonthlySummary(clubId, monthRange)
      .then(setSummary)
      .catch(e => console.error('클럽 통계 로딩 실패:', e))
      .finally(() => setLoading(false));
  }, [clubId, monthRange]);

  // 전체 데이터에서 카테고리별 합산 → 상위 5개 추출
  const topCategories = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of summary) {
      for (const [cat, val] of Object.entries(row.byCategory)) {
        totals[cat] = (totals[cat] || 0) + val;
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
  }, [summary]);

  // 스택 바 차트용 데이터 (기타 합산)
  const categoryChartData = useMemo(() => {
    return summary.map(row => {
      const item: Record<string, number | string> = { label: row.label };
      let etc = 0;
      for (const [cat, val] of Object.entries(row.byCategory)) {
        if (topCategories.includes(cat)) {
          item[cat] = Math.round(val * 10) / 10;
        } else {
          etc += val;
        }
      }
      if (etc > 0) item['기타'] = Math.round(etc * 10) / 10;
      return item;
    });
  }, [summary, topCategories]);

  const barsForCategory = [
    ...topCategories,
    ...(categoryChartData.some(d => d['기타']) ? ['기타'] : []),
  ];

  const mileageData = summary.map(r => ({
    label: r.label,
    마일리지: Math.round(r.totalMileage * 10) / 10,
  }));

  const memberData = summary.map(r => ({
    label: r.label,
    활성멤버: r.activeMembers,
  }));

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>클럽 통계</h1>
        </div>
      </div>

      {/* 기간 선택 */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
        {([3, 6] as const).map(n => (
          <button
            key={n}
            onClick={() => setMonthRange(n)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: '1px solid var(--border-color)',
              background: monthRange === n ? 'var(--primary-color)' : 'var(--input-bg)',
              color: monthRange === n ? 'white' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {n}개월
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <p>불러오는 중...</p>
        </div>
      ) : summary.length === 0 ? (
        <div className="empty-state"><p>데이터가 없습니다.</p></div>
      ) : (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* 차트 1: 월별 총 마일리지 */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
              월별 총 마일리지
            </div>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={mileageData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => {
                    const value = Array.isArray(v) ? Number(v[0] ?? 0) : Number(v ?? 0);
                    return [`${value.toLocaleString()}점`, '마일리지'];
                  }}
                  contentStyle={{ fontSize: 13, borderRadius: 8, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <Bar dataKey="마일리지" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 차트 2: 월별 활성 멤버 수 */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
              월별 활성 멤버 수
            </div>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={memberData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => {
                    const value = Array.isArray(v) ? Number(v[0] ?? 0) : Number(v ?? 0);
                    return [`${value}명`, '활성 멤버'];
                  }}
                  contentStyle={{ fontSize: 13, borderRadius: 8, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <Bar dataKey="활성멤버" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 차트 3: 운동 종목별 마일리지 */}
          {barsForCategory.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
                종목별 마일리지 (월별)
              </div>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT + 20}>
                <BarChart data={categoryChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v, name) => {
                      const value = Array.isArray(v) ? Number(v[0] ?? 0) : Number(v ?? 0);
                      return [`${value}점`, name];
                    }}
                    contentStyle={{ fontSize: 13, borderRadius: 8, background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {barsForCategory.map(cat => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="category"
                      fill={categoryColor(cat)}
                      radius={cat === barsForCategory[barsForCategory.length - 1] ? [4, 4, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 요약 카드 (최근 달 기준) */}
          {summary.length > 0 && (() => {
            const latest = summary[summary.length - 1];
            const prev = summary.length > 1 ? summary[summary.length - 2] : null;
            const mileageDiff = prev ? latest.totalMileage - prev.totalMileage : null;
            const memberDiff = prev ? latest.activeMembers - prev.activeMembers : null;
            return (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
                  이번 달 요약
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    {
                      label: '총 마일리지',
                      value: `${latest.totalMileage.toFixed(0)}점`,
                      diff: mileageDiff,
                      diffUnit: '점',
                    },
                    {
                      label: '활성 멤버',
                      value: `${latest.activeMembers}명`,
                      diff: memberDiff,
                      diffUnit: '명',
                    },
                  ].map(({ label, value, diff, diffUnit }) => (
                    <div
                      key={label}
                      style={{
                        background: 'var(--input-bg)',
                        borderRadius: 12,
                        padding: '14px 16px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
                      {diff !== null && (
                        <div style={{
                          fontSize: 12,
                          marginTop: 4,
                          color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-secondary)',
                        }}>
                          {diff > 0 ? `▲ +${diff.toFixed(diff % 1 === 0 ? 0 : 1)}${diffUnit}` : diff < 0 ? `▼ ${diff.toFixed(diff % 1 === 0 ? 0 : 1)}${diffUnit}` : '변동 없음'}
                          <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>전달 대비</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
};
