import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { EVENT_TYPE_ICONS, EVENT_TYPE_LABELS, type ClubEvent, type EventPhotoSummary } from '../services/clubEventService';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const VISIBLE_COUNT = 3;

// 시각은 메모(1. 일시)에 적으므로 여기선 달력 배치용 날짜만 표시한다.
function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`;
}

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

interface UpcomingProps {
  /** 오늘 이후(오늘 제외) 행사, 가까운 순 */
  events: ClubEvent[];
  /** 이 클럽에 행사가 하나라도 있는지 — 빈 상태 문구 구분용 */
  hasAnyEvent: boolean;
  isManager: boolean;
  onOpen: (eventId: string) => void;
  onCreate: () => void;
}

// 마라톤 대회처럼 미리 잡는 일정이 대부분이라 "며칠 남았나"(D-day)를 앞세운다.
export const UpcomingEventsSection = ({ events, hasAnyEvent, isManager, onOpen, onCreate }: UpcomingProps) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? events : events.slice(0, VISIBLE_COUNT);
  const hiddenCount = events.length - VISIBLE_COUNT;

  return (
    <div className="upcoming-events-section">
      <div className="club-section-head">
        <h3 className="section-title">다가오는 행사</h3>
        {isManager && (
          <button type="button" className="club-section-action" onClick={onCreate}>
            + 등록
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <p className="club-section-empty">
          {hasAnyEvent ? '예정된 행사가 없어요.' : '아직 등록된 행사가 없어요. 첫 행사를 등록해 보세요.'}
        </p>
      ) : (
        <>
          {shown.map((event) => (
            <button key={event.id} type="button" className="upcoming-event-card" onClick={() => onOpen(event.id)}>
              <span className="dday-badge">D-{daysUntil(event.starts_at)}</span>
              <span className="upcoming-event-icon">{EVENT_TYPE_ICONS[event.event_type]}</span>
              <div className="upcoming-event-info">
                <div className="upcoming-event-title">{event.title}</div>
                <div className="upcoming-event-meta">
                  {formatEventDate(event.starts_at)}
                  {event.category_text && ` · ${event.category_text}`}
                </div>
              </div>
              <ChevronRight size={18} className="upcoming-event-chevron" />
            </button>
          ))}
          {hiddenCount > 0 && (
            <button type="button" className="club-section-more" onClick={() => setExpanded((v) => !v)}>
              {expanded ? '접기' : `더보기 (${hiddenCount})`}
            </button>
          )}
        </>
      )}
    </div>
  );
};

interface PastProps {
  /** 사진이 있는 지난 행사, 최신순 */
  items: { event: ClubEvent; summary: EventPhotoSummary }[];
  onOpen: (eventId: string) => void;
}

// 가장 많이 쓰이는 자산(행사 사진)에 달력을 넘기지 않고 닿는 길.
export const PastEventsSection = ({ items, onOpen }: PastProps) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const hiddenCount = items.length - VISIBLE_COUNT;

  return (
    <div className="upcoming-events-section">
      <div className="club-section-head">
        <h3 className="section-title">지난 행사</h3>
      </div>
      {shown.map(({ event, summary }) => (
        <button key={event.id} type="button" className="upcoming-event-card" onClick={() => onOpen(event.id)}>
          <img className="past-event-cover" src={summary.coverUrl} alt="" loading="lazy" />
          <div className="upcoming-event-info">
            <div className="upcoming-event-title">{event.title}</div>
            <div className="upcoming-event-meta">
              {formatEventDate(event.starts_at)} · {event.category_text || EVENT_TYPE_LABELS[event.event_type]}
            </div>
            <div className="upcoming-event-participants">📷 사진 {summary.count}장</div>
          </div>
          <ChevronRight size={18} className="upcoming-event-chevron" />
        </button>
      ))}
      {hiddenCount > 0 && (
        <button type="button" className="club-section-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '접기' : `더보기 (${hiddenCount})`}
        </button>
      )}
    </div>
  );
};
