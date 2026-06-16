import { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  unit: string;
  onChange: (v: string) => void;
  onClose: () => void;
}

export default function ValuePickerSheet({ value, unit, onChange, onClose }: Props) {
  // 단위별 자릿수 범위 (디지털 다이얼)
  // km: -1 ~ 2 (소수점 첫째 자리 ~ 백의 자리)
  // m:   0 ~ 3 (일 ~ 천)
  // 기타: 0 ~ 2 (일 ~ 백)
  const maxExp = unit === 'm' ? 3 : 2;
  const minExp = unit === 'km' ? -1 : 0;
  const maxVal = unit === 'm' ? 9999 : unit === 'km' ? 999.9 : 999;

  const [localValue, setLocalValue] = useState(value || '');
  const [cursorExp, setCursorExp] = useState(unit === 'km' ? 0 : 1); // km은 일의자리, 그외 십의자리 디폴트
  const [directMode, setDirectMode] = useState(false);
  const cursorExpRef = useRef(cursorExp);
  cursorExpRef.current = Math.max(minExp, Math.min(maxExp, cursorExp));

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchActiveRef = useRef(false);

  const directInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (directMode) directInputRef.current?.focus();
  }, [directMode]);

  const numVal = parseFloat(localValue) || 0;
  const hiFromVal = numVal >= 1 ? Math.floor(Math.log10(numVal)) : 0;
  const loFromStr = (() => {
    const dot = (localValue || '').indexOf('.');
    return dot === -1 ? 0 : -(localValue.length - dot - 1);
  })();
  const clampedExp = cursorExpRef.current;
  const hiExp = Math.max(clampedExp > 0 ? clampedExp : 0, hiFromVal);
  const loExp = Math.min(clampedExp < 0 ? clampedExp : 0, loFromStr);
  const displayExps = Array.from({ length: hiExp - loExp + 1 }, (_, i) => hiExp - i);

  const getDigitAtExp = (exp: number): number =>
    exp >= 0
      ? Math.floor(numVal / Math.pow(10, exp)) % 10
      : Math.floor(numVal * Math.pow(10, -exp)) % 10;

  const adjustAtExp = (exp: number, delta: 1 | -1) => {
    const pv = Math.pow(10, exp);
    setLocalValue(prev => {
      const str = prev || '0';
      const dot = str.indexOf('.');
      const currentDecimals = dot === -1 ? 0 : str.length - dot - 1;
      const resultDecimals = Math.max(currentDecimals, exp < 0 ? -exp : 0);
      const n = Math.min(maxVal, Math.max(0, (parseFloat(str) || 0) + delta * pv));
      return n.toFixed(resultDecimals);
    });
  };

  const startStep = (delta: 1 | -1) => {
    const doAdjust = () => adjustAtExp(cursorExpRef.current, delta);
    doAdjust();
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(doAdjust, 100);
    }, 1000);
  };

  const stopStep = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => () => stopStep(), []);

  const confirm = () => {
    onChange(localValue);
    onClose();
  };

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet value-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 28 }} />
          <span className="date-picker-title">값 입력</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        {directMode ? (
          <div className="value-picker-direct">
            <input
              ref={directInputRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className="step3-direct-input"
              placeholder="0"
            />
            <span className="step3-direct-unit">{unit}</span>
          </div>
        ) : (
          <div className="step3-value-row">
            <button
              type="button"
              className="step3-nav-arrow"
              onClick={() => setCursorExp(e => Math.min(maxExp, e + 1))}
            >‹</button>
            <div className="step3-digit-display">
              {displayExps.map(exp => {
                const d = getDigitAtExp(exp);
                const isActive = clampedExp === exp;
                const isLeadingZero = !isActive && exp >= 0 && d === 0
                  && displayExps.filter(e => e > exp).every(e => getDigitAtExp(e) === 0);
                return (
                  <span key={exp} className="step3-digit-slot">
                    {exp === -1 && <span className="step3-digit-dot">.</span>}
                    <div className={`step3-digit-col${isActive ? ' active' : ''}`}>
                      <button
                        type="button"
                        className="step3-digit-adj-btn step3-digit-adj-plus"
                        onMouseDown={() => { if (touchActiveRef.current) return; startStep(1); }}
                        onMouseUp={stopStep}
                        onMouseLeave={stopStep}
                        onTouchStart={(e) => { e.preventDefault(); touchActiveRef.current = true; startStep(1); }}
                        onTouchEnd={() => { stopStep(); setTimeout(() => { touchActiveRef.current = false; }, 300); }}
                      >+</button>
                      <button
                        type="button"
                        className={`step3-digit-box${isActive ? ' selected' : ''}${isLeadingZero ? ' dim' : ''}`}
                        onClick={() => setCursorExp(exp)}
                      >{d}</button>
                      <button
                        type="button"
                        className="step3-digit-adj-btn step3-digit-adj-minus"
                        onMouseDown={() => { if (touchActiveRef.current) return; startStep(-1); }}
                        onMouseUp={stopStep}
                        onMouseLeave={stopStep}
                        onTouchStart={(e) => { e.preventDefault(); touchActiveRef.current = true; startStep(-1); }}
                        onTouchEnd={() => { stopStep(); setTimeout(() => { touchActiveRef.current = false; }, 300); }}
                      >−</button>
                    </div>
                  </span>
                );
              })}
              <span className="step3-digit-unit-label">{unit}</span>
            </div>
            <button
              type="button"
              className="step3-nav-arrow"
              onClick={() => setCursorExp(e => Math.max(minExp, e - 1))}
            >›</button>
          </div>
        )}

        <div className="value-picker-actions">
          <button
            type="button"
            className="value-picker-toggle"
            onClick={() => setDirectMode(d => !d)}
          >
            {directMode ? '🎛️ 다이얼 모드' : '⌨️ 직접 입력'}
          </button>
          <button
            type="button"
            className="challenge-create-submit"
            onClick={confirm}
            disabled={!localValue || parseFloat(localValue) <= 0}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
