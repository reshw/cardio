import { useState, useEffect } from 'react';

interface Props {
  value: string;        // YYYY-MM-DDTHH:mm (local)
  onChange: (v: string) => void;
  onClose: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export default function DatePickerSheet({ value, onChange, onClose }: Props) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const twoDaysAgo = new Date(today.getTime() - 172_800_000);
  const min48h = new Date(now.getTime() - 172_800_000);

  const initState = () => {
    const d = new Date(value);
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let day: 0 | 1 | 2 = 0;
    if (dDay === yesterday.getTime()) day = 1;
    else if (dDay === twoDaysAgo.getTime()) day = 2;
    return { day, hour: d.getHours(), minute: d.getMinutes() };
  };

  const init = initState();
  const [pickerDay, setPickerDay] = useState<0 | 1 | 2>(init.day);
  const [pickerHour, setPickerHour] = useState(init.hour);
  const [pickerMinute, setPickerMinute] = useState(init.minute);

  const getHourBounds = (day: number) => ({
    min: day === 2 ? min48h.getHours() : 0,
    max: day === 0 ? now.getHours() : 23,
  });
  const getMinuteBounds = (day: number, hour: number) => {
    const hb = getHourBounds(day);
    return {
      min: day === 2 && hour === hb.min ? min48h.getMinutes() : 0,
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
    const base = [today, yesterday, twoDaysAgo][pickerDay];
    const str = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(pickerHour)}:${pad(pickerMinute)}`;
    onChange(str);
    onClose();
  };

  const { min: minH, max: maxH } = getHourBounds(pickerDay);
  const { min: minM, max: maxM } = getMinuteBounds(pickerDay, pickerHour);

  const DAY_LABELS = ['오늘', '어제', '이틀 전'];

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet date-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 28 }} />
          <span className="date-picker-title">날짜·시간 선택</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="date-picker-day-tabs">
          {DAY_LABELS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              className={`date-picker-day-btn${pickerDay === idx ? ' active' : ''}`}
              onClick={() => setPickerDay(idx as 0 | 1 | 2)}
            >{label}</button>
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
