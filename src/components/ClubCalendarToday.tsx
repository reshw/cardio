import { ChevronRight } from 'lucide-react';
import { EVENT_TYPE_ICONS, EVENT_TYPE_LABELS, type ClubEvent } from '../services/clubEventService';
import type { DaySheetTab } from './ClubDaySheet';

interface Props {
  /** 오늘 행사 (행사 기능 꺼진 클럽은 항상 빈 배열) */
  todayEvents: ClubEvent[];
  /** 오늘 클럽원 운동 횟수 (필터와 무관). 아직 모르면 null */
  workoutCount: number | null;
  /** 오늘 행사 중 첫 번째의 사진 수 */
  photoCount: number;
  onOpen: (tab: DaySheetTab) => void;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// 메모(양식: "1. 일시: …\n2. 집결장소: …")에서 값이 채워진 첫 줄. 양식만 있고 비어 있으면 null.
export function memoPreview(description?: string): string | null {
  if (!description) return null;
  for (const raw of description.split('\n')) {
    const line = raw.replace(/^\s*\d+\.\s*/, '').trim();
    const colon = line.indexOf(':');
    const value = colon >= 0 ? line.slice(colon + 1).trim() : line;
    if (value) return line;
  }
  return null;
}

// 클럽달력 맨 위 "오늘" 카드. 오늘 행사가 있으면 행사, 없으면 오늘 운동 요약 한 줄.
// 시각은 표시하지 않는다 — 행사가 거의 전부 00:00(종일)이라 "오전 12:00"이 찍히면 오해를 산다.
export const ClubCalendarToday = ({ todayEvents, workoutCount, photoCount, onOpen }: Props) => {
  const now = new Date();
  const label = `오늘 · ${now.getMonth() + 1}월 ${now.getDate()}일 (${WEEKDAY_KO[now.getDay()]})`;
  const first = todayEvents[0];
  const preview = first ? memoPreview(first.description) : null;

  return (
    <section className="club-today-card">
      <div className="club-today-label">{label}</div>

      {first ? (
        <button type="button" className="club-today-body" onClick={() => onOpen('event')}>
          <span className="upcoming-event-icon">{EVENT_TYPE_ICONS[first.event_type]}</span>
          <div className="upcoming-event-info">
            <div className="upcoming-event-title">
              {first.title}
              {todayEvents.length > 1 && <span className="club-today-more"> +{todayEvents.length - 1}건</span>}
            </div>
            <div className="upcoming-event-meta club-today-meta">
              {first.category_text || EVENT_TYPE_LABELS[first.event_type]}
              {preview && ` · ${preview}`}
            </div>
          </div>
          {photoCount > 0 && <span className="club-today-photos">📷 {photoCount}</span>}
          <ChevronRight size={18} className="upcoming-event-chevron" />
        </button>
      ) : (
        <button type="button" className="club-today-body" onClick={() => onOpen('workout')}>
          <div className="upcoming-event-info club-today-summary">
            {workoutCount === null
              ? '오늘 운동 기록 보기'
              : workoutCount > 0
                ? `오늘 클럽원 ${workoutCount}회 운동했어요`
                : '오늘은 아직 운동 기록이 없어요'}
          </div>
          <ChevronRight size={18} className="upcoming-event-chevron" />
        </button>
      )}
    </section>
  );
};
