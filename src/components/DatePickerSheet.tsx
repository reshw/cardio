import { useState, useEffect } from 'react';

interface Props {
  value: string;        // YYYY-MM-DDTHH:mm (local)
  onChange: (v: string) => void;
  onClose: () => void;
  maxDays?: number | null; // 당일 포함 선택 가능 일수, null = 무제한 (칩은 최근 90일까지)
}

const pad = (n: number) => String(n).padStart(2, '0');
const WDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const UNLIMITED_CHIP_DAYS = 90;

const dayLabel = (date: Date, idx: number) => {
  if (idx === 0) return '오늘';
  if (idx === 1) return '어제';
  if (idx === 2) return '이틀 전';
  return `${date.getMonth() + 1}/${date.getDate()} (${WDAYS[date.getDay()]})`;
};

export default function DatePickerSheet({ value, onChange, onClose, maxDays = 3 }: Props) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayCount = Math.min(UNLIMITED_CHIP_DAYS, Math.max(1, maxDays ?? UNLIMITED_CHIP_DAYS));
  const dayDates = Array.from({ length: dayCount }, (_, i) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
  );

  const initState = () => {
    const d = new Date(value);
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const idx = dayDates.findIndex(dd => dd.getTime() === dDay);
    return { day: idx >= 0 ? idx : 0, hour: d.getHours(), minute: d.getMinutes() };
  };

  const init = initState();
  const [pickerDay, setPickerDay] = useState(init.day);
  const [pickerHour, setPickerHour] = useState(init.hour);
  const [pickerMinute, setPickerMinute] = useState(init.minute);

  // 오늘은 현재 시각까지만, 과거 날짜는 종일 허용
  const getHourBounds = (day: number) => ({
    min: 0,
    max: day === 0 ? now.getHours() : 23,
  });
  const getMinuteBounds = (day: number, hour: number) => {
    const hb = getHourBounds(day);
    return {
      min: 0,
      max: day === 0 && hour === hb.max ? now.getMinutes() : 59,
    };
  };

  useEffect(() => {
    const { min, max } = getHourBounds(pickerDay);
    setPickerHour(h => Math.min(max, Math.max(min, h)));
  }, [pickerDay]);

  useEffect(() => {
    const { min, max } = getMinuteBounds(pickerDay, pickerHour);
    setPickerMinute(m => Math.min(max, Math.max(min, m)));
  }, [pickerHour, pickerDay]);

  const handleConfirm = () => {
    const base = dayDates[pickerDay];
    const str = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(pickerHour)}:${pad(pickerMinute)}`;
    onChange(str);
    onClose();
  };

  const { min: minH, max: maxH } = getHourBounds(pickerDay);
  const { min: minM, max: maxM } = getMinuteBounds(pickerDay, pickerHour);

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet date-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 28 }} />
          <span className="date-picker-title">날짜·시간 선택</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className={`date-picker-day-tabs${dayCount > 3 ? ' scrollable' : ''}`}>
          {dayDates.map((date, idx) => (
            <button
              key={idx}
              type="button"
              className={`date-picker-day-btn${pickerDay === idx ? ' active' : ''}`}
              onClick={() => setPickerDay(idx)}
            >{dayLabel(date, idx)}</button>
          ))}
        </div>

        <div className="date-picker-time-section">
          <div className="date-picker-time-row">
            <SpinPicker value={pickerHour} min={minH} max={maxH} onChange={setPickerHour} label="시" />
            <span className="date-picker-colon">:</span>
            <SpinPicker value={pickerMinute} min={minM} max={maxM} onChange={setPickerMinute} label="분" />
          </div>
        </div>

        <div className="date-picker-footer">
          <button type="button" className="challenge-create-submit" onClick={handleConfirm}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

interface SpinProps {
  value: number; min: number; max: number;
  onChange: (v: number) => void; label: string;
}

function SpinPicker({ value, min, max, onChange, label }: SpinProps) {
  return (
    <div className="date-picker-spin">
      <button
        type="button"
        className="date-picker-spin-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >▲</button>
      <div className="date-picker-spin-val">
        {pad(value)}
        <span className="date-picker-spin-label">{label}</span>
      </div>
      <button
        type="button"
        className="date-picker-spin-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >▼</button>
    </div>
  );
}
