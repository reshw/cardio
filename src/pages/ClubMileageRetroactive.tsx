import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import clubService from '../services/clubService';

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

function clampMonth(y: number, m: number): number {
  if (y === CUR_YEAR && m > CUR_MONTH) return CUR_MONTH;
  return m;
}

export const ClubMileageRetroactive = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const defaultFrom = CUR_MONTH === 1 ? { y: CUR_YEAR - 1, m: 12 } : { y: CUR_YEAR, m: CUR_MONTH - 1 };

  const [fromYear, setFromYear] = useState(defaultFrom.y);
  const [fromMonth, setFromMonth] = useState(defaultFrom.m);
  const [toYear, setToYear] = useState(CUR_YEAR);
  const [toMonth, setToMonth] = useState(CUR_MONTH);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<{ errors: string[] } | null>(null);

  const months = getMonthRange(fromYear, fromMonth, toYear, toMonth);
  const isRangeValid = months.length > 0;

  const handleRun = async () => {
    if (!clubId || !isRangeValid) return;
    if (!confirm(`${fromYear}년 ${fromMonth}월 ~ ${toYear}년 ${toMonth}월 (${months.length}개월)\n현재 마일리지 계수로 소급 재계산합니다.\n\n계속하시겠습니까?`)) return;

    setRunning(true);
    setResult(null);
    const errors: string[] = [];

    for (let i = 0; i < months.length; i++) {
      const { year, month } = months[i];
      setProgress({ current: i + 1, total: months.length, label: `${year}년 ${month}월` });
      try {
        await clubService.recalculateClubMonthMileage(clubId, year, month);
      } catch {
        errors.push(`${year}년 ${month}월`);
      }
    }

    setRunning(false);
    setProgress(null);
    setResult({ errors });
  };

  const handleFromYearChange = (y: number) => {
    setFromYear(y);
    setFromMonth(prev => clampMonth(y, prev));
  };

  const handleToYearChange = (y: number) => {
    setToYear(y);
    setToMonth(prev => clampMonth(y, prev));
  };

  const handleToMonthChange = (m: number) => {
    setToMonth(clampMonth(toYear, m));
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>소급 재계산</h1>
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 안내 */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '16px',
          fontSize: 14,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>소급 재계산이란?</p>
          <p style={{ margin: 0 }}>
            과거 기간의 운동 기록에 <strong>현재 설정된 계수</strong>를 소급 적용합니다.
            계수를 변경한 후 이전 달 기록도 새 계수로 업데이트하고 싶을 때 사용하세요.
          </p>
        </div>

        {/* 기간 선택 */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            재계산 기간
          </div>

          {/* 시작 월 */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>시작</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={fromYear}
                onChange={e => handleFromYearChange(Number(e.target.value))}
                disabled={running}
                style={selectStyle}
              >
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select
                value={fromMonth}
                onChange={e => setFromMonth(Number(e.target.value))}
                disabled={running}
                style={selectStyle}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1)
                  .filter(m => fromYear < CUR_YEAR || m <= CUR_MONTH)
                  .map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
          </div>

          {/* 종료 월 */}
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>종료</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={toYear}
                onChange={e => handleToYearChange(Number(e.target.value))}
                disabled={running}
                style={selectStyle}
              >
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select
                value={toMonth}
                onChange={e => handleToMonthChange(Number(e.target.value))}
                disabled={running}
                style={selectStyle}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1)
                  .filter(m => toYear < CUR_YEAR || m <= CUR_MONTH)
                  .map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 범위 요약 */}
        {isRangeValid ? (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {fromYear}년 {fromMonth}월 ~ {toYear}년 {toMonth}월 · 총 <strong>{months.length}개월</strong> 재계산
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#FF6B6B' }}>
            종료 월이 시작 월보다 빠릅니다.
          </div>
        )}

        {/* 진행 상황 */}
        {running && progress && (
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '16px',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary-color)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {progress.label} 처리 중...
              </span>
            </div>
            <div style={{ background: 'var(--input-bg)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 6,
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

        {/* 결과 */}
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
                    {months.length}개월 모두 성공적으로 처리됐습니다.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <AlertCircle size={20} color="#FF6B6B" />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    일부 실패 ({result.errors.length}개월)
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  실패: {result.errors.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 실행 버튼 */}
        <button
          onClick={handleRun}
          disabled={running || !isRangeValid}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 12,
            border: 'none',
            background: running || !isRangeValid ? 'var(--input-bg)' : 'var(--primary-color)',
            color: running || !isRangeValid ? 'var(--text-secondary)' : 'white',
            fontSize: 15,
            fontWeight: 600,
            cursor: running || !isRangeValid ? 'not-allowed' : 'pointer',
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
