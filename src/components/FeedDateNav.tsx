import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CalendarPickerSheet from './CalendarPickerSheet';

interface Props {
  date: Date;
  onChange: (days: number) => void;
  onSelect: (date: Date) => void;
  /** 이 날짜까지만 이동 가능. 생략하면 미래로도 이동 가능 */
  maxDate?: Date;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

// 오늘운동 탭(WorkoutFeed)과 클럽달력 날짜 시트(ClubDaySheet)가 같이 쓰는 날짜 이동 줄.
export const FeedDateNav = ({ date, onChange, onSelect, maxDate }: Props) => {
  const [showPicker, setShowPicker] = useState(false);

  const isToday = startOfDay(date) === startOfDay(new Date());
  const atMax = maxDate ? startOfDay(date) >= startOfDay(maxDate) : false;
  const label = isToday ? '오늘' : `${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <>
      <div className="feed-date-navigation">
        <button type="button" className="date-nav-button" onClick={() => onChange(-1)}>
          <ChevronLeft size={20} />
        </button>

        {/* 네이티브 <input type="date"> 를 투명 오버레이로 덮어 탭하게 하는 방식은
            이 앱의 Android/iOS WebView 에서 실제로 안 열려(known WebView 이슈) —
            연도·월을 자유롭게 넘나드는 실제 캘린더 피커(CalendarPickerSheet)로 교체. */}
        <button type="button" className="feed-date-display" onClick={() => setShowPicker(true)}>
          {label}
        </button>

        <button type="button" className="date-nav-button" onClick={() => onChange(1)} disabled={atMax}>
          <ChevronRight size={20} />
        </button>

        {!isToday && (
          <button type="button" className="date-nav-today-btn" onClick={() => onSelect(new Date())}>
            오늘
          </button>
        )}
      </div>

      {showPicker && (
        <CalendarPickerSheet
          value={date}
          onChange={onSelect}
          onClose={() => setShowPicker(false)}
          maxDate={maxDate}
        />
      )}
    </>
  );
};
