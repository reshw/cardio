import { createPortal } from 'react-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useModalHistory } from '../hooks/useModalHistory';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  maxDate?: Date;
}

// DatePickerSheet(오늘/어제 상대 날짜 칩)와 달리, 연도·월을 자유롭게 넘나들며
// 임의의 날짜를 고를 때 쓰는 실제 캘린더 피커. react-calendar 기본 네비게이션
// (라벨 클릭 → 연도 뷰 → 연대 뷰로 drill-up) 을 그대로 쓴다 — App.css 에서
// .react-calendar__navigation 을 전역으로 숨겨놨어서(History.tsx 전용 커스텀
// 월 이동 버튼 때문) .calendar-picker-sheet 안에서만 다시 보이게 오버라이드함.
export default function CalendarPickerSheet({ value, onChange, onClose, maxDate }: Props) {
  useModalHistory(true, onClose);

  return createPortal(
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet calendar-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 28 }} />
          <span className="date-picker-title">날짜 선택</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>
        <Calendar
          locale="ko-KR"
          calendarType="gregory"
          value={value}
          maxDate={maxDate}
          onChange={(date) => {
            onChange(date as Date);
            onClose();
          }}
          formatDay={(_locale, date) => String(date.getDate())}
        />
      </div>
    </div>,
    document.body
  );
}
