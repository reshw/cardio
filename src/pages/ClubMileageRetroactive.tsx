import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { ChevronLeft, RefreshCw, CheckCircle, AlertCircle, Download } from 'lucide-react';
import clubService from '../services/clubService';
import type { ClubMileageConfigRow } from '../services/clubService';

// ── helpers ────────────────────────────────────────────────────────────────────

function getMonthRange(fy: number, fm: number, ty: number, tm: number) {
  const months: { year: number; month: number }[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

const now = new Date();
const CUR_YEAR = now.getFullYear();
const CUR_MONTH = now.getMonth() + 1;
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => CUR_YEAR - i);

function capMonth(y: number, m: number) {
  return y === CUR_YEAR && m > CUR_MONTH ? CUR_MONTH : m;
}

function configLabel(category: string, sub_type: string | null) {
  return sub_type ? `${category} · ${sub_type}` : category;
}

// ── types ──────────────────────────────────────────────────────────────────────

type Mode = 'current' | 'custom';

interface EditRow {
  category: string;
  sub_type: string | null;
  coefficient: string; // string so <input> is controlled
  enabled: boolean;
}

// ── component ──────────────────────────────────────────────────────────────────

export const ClubMileageRetroactive = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();

  const defaultFrom = CUR_MONTH === 1
    ? { y: CUR_YEAR - 1, m: 12 }
    : { y: CUR_YEAR, m: CUR_MONTH - 1 };

  // mode
  const [mode, setMode] = useState<Mode>('current');

  // date range
  const [fromYear, setFromYear] = useState(defaultFrom.y);
  const [fromMonth, setFromMonth] = useState(defaultFrom.m);
  const [toYear, setToYear] = useState(CUR_YEAR);
  const [toMonth, setToMonth] = useState(CUR_MONTH);

  // custom config editing
  const [rows, setRows] = useState<EditRow[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configsError, setConfigsError] = useState(false);

  // execution
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<{ errors: string[]; total: number } | null>(null);

  // ── load configs when switching to custom mode ─────────────────────────────

  useEffect(() => {
    if (mode === 'custom' && rows.length === 0 && clubId) {
      loadConfigs();
    }
  }, [mode]);

  const loadConfigs = async () => {
    if (!clubId) return;
    setConfigsLoading(true);
    setConfigsError(false);
    try {
      const data = await clubService.getClubMileageConfigs(clubId);
      setRows(data.map((r: ClubMileageConfigRow) => ({
        category: r.category,
        sub_type: r.sub_type ?? null,
        coefficient: String(r.coefficient),
        enabled: r.enabled,
      })));
    } catch {
      setConfigsError(true);
    } finally {
      setConfigsLoading(false);
    }
  };

  // ── range helpers ──────────────────────────────────────────────────────────

  const months = getMonthRange(fromYear, fromMonth, toYear, toMonth);
  const rangeValid = months.length > 0;

  const handleFromYearChange = (y: number) => {
    setFromYear(y);
    setFromMonth(prev => capMonth(y, prev));
  };
  const handleToYearChange = (y: number) => {
    setToYear(y);
    setToMonth(prev => capMonth(y, prev));
  };

  // ── row editing ────────────────────────────────────────────────────────────

  const updateRow = (idx: number, patch: Partial<EditRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const customConfigsValid = rows.every(r => {
    const v = parseFloat(r.coefficient);
    return !isNaN(v) && v >= 0;
  });

  // ── execute ────────────────────────────────────────────────────────────────

  const handleRun = async () => {
    if (!clubId || !rangeValid) return;
    if (mode === 'custom' && !customConfigsValid) return;

    const label = `${fromYear}년 ${fromMonth}월 ~ ${toYear}년 ${toMonth}월 (${months.length}개월)\n현재 설정으로 소급 재계산합니다.`;
    const customLabel = `${fromYear}년 ${fromMonth}월 ~ ${toYear}년 ${toMonth}월 (${months.length}개월)\n직접 설정한 계수로 소급 재계산합니다.\n클럽의 현재 계수는 변경되지 않습니다.`;

    if (!confirm(mode === 'current' ? label : customLabel)) return;

    setRunning(true);
    setResult(null);
    const errors: string[] = [];

    const customConfigs = mode === 'custom'
      ? rows.map(r => ({
          category: r.category,
          sub_type: r.sub_type,
          coefficient: parseFloat(r.coefficient),
          enabled: r.enabled,
        }))
      : null;

    for (let i = 0; i < months.length; i++) {
      const { year, month } = months[i];
      setProgress({ current: i + 1, total: months.length, label: `${year}년 ${month}월` });
      try {
        if (customConfigs) {
          await clubService.recalculateClubMonthMileageCustom(clubId, year, month, customConfigs);
        } else {
          await clubService.recalculateClubMonthMileage(clubId, year, month);
        }
      } catch {
        errors.push(`${year}년 ${month}월`);
      }
    }

    setRunning(false);
    setProgress(null);
    setResult({ errors, total: months.length });
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>소급 재계산</h1>
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── 모드 선택 ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['current', 'custom'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); }}
              disabled={running}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 10,
                border: `2px solid ${mode === m ? 'var(--primary-color)' : 'var(--border-color)'}`,
                background: mode === m ? 'rgba(59,130,246,0.10)' : 'var(--card-bg)',
                color: mode === m ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: mode === m ? 700 : 500,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {m === 'current' ? '현재 설정 소급' : '직접 계수 설정'}
            </button>
          ))}
        </div>

        {/* ── 안내 ── */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}>
          {mode === 'current' ? (
            <>현재 클럽에 설정된 계수를 선택한 기간에 그대로 소급 적용합니다.</>
          ) : (
            <>계수를 직접 수정하여 적용합니다. <strong style={{ color: 'var(--text-primary)' }}>클럽 설정은 변경되지 않습니다.</strong></>
          )}
        </div>

        {/* ── 기간 선택 ── */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={sectionTitleStyle}>재계산 기간</div>
          <div style={rangeRowStyle}>
            <span style={rangeLabelStyle}>시작</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={fromYear} onChange={e => handleFromYearChange(Number(e.target.value))} disabled={running} style={selectStyle}>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={fromMonth} onChange={e => setFromMonth(Number(e.target.value))} disabled={running} style={selectStyle}>
                {Array.from({ length: 12 }, (_, i) => i + 1)
                  .filter(m => fromYear < CUR_YEAR || m <= CUR_MONTH)
                  .map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...rangeRowStyle, borderBottom: 'none' }}>
            <span style={rangeLabelStyle}>종료</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={toYear} onChange={e => handleToYearChange(Number(e.target.value))} disabled={running} style={selectStyle}>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={toMonth} onChange={e => setToMonth(capMonth(toYear, Number(e.target.value)))} disabled={running} style={selectStyle}>
                {Array.from({ length: 12 }, (_, i) => i + 1)
                  .filter(m => toYear < CUR_YEAR || m <= CUR_MONTH)
                  .map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 범위 요약 */}
        <div style={{ textAlign: 'center', fontSize: 13, color: rangeValid ? 'var(--text-secondary)' : '#FF6B6B' }}>
          {rangeValid
            ? <>{fromYear}년 {fromMonth}월 ~ {toYear}년 {toMonth}월 · 총 <strong>{months.length}개월</strong></>
            : '종료 월이 시작 월보다 빠릅니다.'}
        </div>

        {/* ── 직접 설정 계수 테이블 ── */}
        {mode === 'custom' && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>계수 편집</span>
              <button
                onClick={loadConfigs}
                disabled={configsLoading || running}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                <Download size={13} />
                현재 설정 불러오기
              </button>
            </div>

            {configsLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: 6, display: 'block', margin: '0 auto 8px' }} />
                불러오는 중...
              </div>
            ) : configsError ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#FF6B6B', fontSize: 13 }}>
                설정을 불러오지 못했습니다.{' '}
                <button onClick={loadConfigs} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: 13 }}>재시도</button>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                설정된 계수가 없습니다.
              </div>
            ) : (
              <>
                {/* 헤더 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 44px', padding: '8px 16px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <span>종목</span>
                  <span style={{ textAlign: 'right' }}>계수</span>
                  <span style={{ textAlign: 'center' }}>활성</span>
                </div>
                {rows.map((row, idx) => {
                  const coefVal = parseFloat(row.coefficient);
                  const invalid = row.coefficient !== '' && (isNaN(coefVal) || coefVal < 0);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 90px 44px',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: idx < rows.length - 1 ? '1px solid var(--border-color)' : 'none',
                        opacity: row.enabled ? 1 : 0.45,
                      }}
                    >
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                        {configLabel(row.category, row.sub_type)}
                      </span>
                      <input
                        type="number"
                        value={row.coefficient}
                        min={0}
                        step={0.01}
                        onChange={e => updateRow(idx, { coefficient: e.target.value })}
                        disabled={running || !row.enabled}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 7,
                          border: `1px solid ${invalid ? '#FF6B6B' : 'var(--border-color)'}`,
                          background: 'var(--input-bg)',
                          color: 'var(--text-primary)',
                          fontSize: 14,
                          textAlign: 'right',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={e => updateRow(idx, { enabled: e.target.checked })}
                          disabled={running}
                          style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── 진행 상황 ── */}
        {running && progress && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-color)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {progress.label} 처리 중...
              </span>
            </div>
            <div style={{ background: 'var(--input-bg)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6,
                background: 'var(--primary-color)',
                width: `${(progress.current / progress.total) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              {progress.current} / {progress.total}
            </div>
          </div>
        )}

        {/* ── 결과 ── */}
        {result && !running && (
          <div style={{
            background: 'var(--card-bg)',
            border: `1px solid ${result.errors.length === 0 ? '#34d39933' : '#FF6B6B44'}`,
            borderRadius: 12,
            padding: '16px',
          }}>
            {result.errors.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={20} color="#34d399" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>재계산 완료</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {result.total}개월 모두 성공적으로 처리됐습니다.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <AlertCircle size={20} color="#FF6B6B" />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    일부 실패 ({result.errors.length}/{result.total})
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  실패: {result.errors.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 실행 버튼 ── */}
        <button
          onClick={handleRun}
          disabled={running || !rangeValid || (mode === 'custom' && (configsLoading || !customConfigsValid || rows.length === 0))}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 12,
            border: 'none',
            background: (running || !rangeValid || (mode === 'custom' && (configsLoading || !customConfigsValid || rows.length === 0)))
              ? 'var(--input-bg)'
              : 'var(--primary-color)',
            color: (running || !rangeValid || (mode === 'custom' && (configsLoading || !customConfigsValid || rows.length === 0)))
              ? 'var(--text-secondary)'
              : 'white',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={16} />
          {running ? '처리 중...' : '소급 재계산 실행'}
        </button>

      </div>
    </div>
  );
};

// ── styles ─────────────────────────────────────────────────────────────────────

const sectionTitleStyle: React.CSSProperties = {
  padding: '10px 16px 8px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border-color)',
};

const rangeRowStyle: React.CSSProperties = {
  padding: '13px 16px',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const rangeLabelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--text-primary)',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border-color)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: 14,
  cursor: 'pointer',
  outline: 'none',
};
