import { useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import { ChevronRight } from 'lucide-react';
import clubEventService, { type ClubEvent, EVENT_TYPE_ICONS } from '../services/clubEventService';
import { EventDetailSheet } from './EventDetailSheet';
import { CreateEventSheet } from './CreateEventSheet';

interface Props {
  clubId: string;
  userId: string;
  isManager: boolean;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// 시각은 메모(1. 일시)에 적으므로 여기선 달력 배치용 날짜만 표시한다.
function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export const ClubCalendarTab = ({ clubId, userId, isManager }: Props) => {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await clubEventService.listEvents(clubId);
      setEvents(data);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('[클럽달력] 행사 목록 로드 실패:', JSON.stringify(err), err);
      setErrorMsg(err?.message || err?.error_description || err?.hint || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return events
      .filter((e) => new Date(e.starts_at).getTime() >= startOfToday.getTime())
      .slice(0, 2);
  }, [events]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, ClubEvent[]>();
    for (const e of events) {
      const key = dateKey(new Date(e.starts_at));
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const eventsOnSelectedDate = selectedDate ? (eventsByDateKey.get(dateKey(selectedDate)) ?? []) : [];

  return (
    <div className="club-calendar-tab">
      {isManager && (
        <button type="button" className="club-calendar-add-btn" onClick={() => setShowCreateSheet(true)}>
          + 행사 등록
        </button>
      )}

      {loading ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>행사 불러오는 중...</p>
        </div>
      ) : errorMsg ? (
        <div className="empty-state">
          <p>행사를 불러오지 못했습니다.</p>
          <p className="club-calendar-error-detail">{errorMsg}</p>
        </div>
      ) : (
        <>
          {upcomingEvents.length > 0 && (
            <div className="upcoming-events-section">
              <h3 className="section-title">다가오는 행사</h3>
              {upcomingEvents.map((event) => {
                const approvedCount = event.checkins.filter((c) => c.status !== 'rejected').length;
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="upcoming-event-card"
                    onClick={() => setOpenEventId(event.id)}
                  >
                    <span className="upcoming-event-icon">{EVENT_TYPE_ICONS[event.event_type]}</span>
                    <div className="upcoming-event-info">
                      <div className="upcoming-event-title">{event.title}</div>
                      <div className="upcoming-event-meta">
                        {formatEventDate(event.starts_at)}
                        {event.category_text && ` · ${event.category_text}`}
                      </div>
                      {approvedCount > 0 && (
                        <div className="upcoming-event-participants">참가 {approvedCount}명</div>
                      )}
                    </div>
                    <ChevronRight size={18} className="upcoming-event-chevron" />
                  </button>
                );
              })}
            </div>
          )}

          <div className="club-calendar-grid-container">
            <div className="calendar-month-nav">
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              >‹</button>
              <span className="calendar-month-label">
                {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
              </span>
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              >›</button>
            </div>
            <Calendar
              className="club-calendar-grid"
              locale="ko-KR"
              calendarType="gregory"
              activeStartDate={calendarMonth}
              showFixedNumberOfWeeks
              tileClassName={({ date, view }) => {
                if (view !== 'month') return null;
                const classes: string[] = [];
                if (eventsByDateKey.has(dateKey(date))) classes.push('has-event');
                if (date.getDay() === 0) classes.push('is-sunday');
                if (date.getDay() === 6) classes.push('is-saturday');
                return classes.join(' ') || null;
              }}
              onClickDay={(date) => setSelectedDate(date)}
              onActiveStartDateChange={({ activeStartDate }) => {
                if (activeStartDate) setCalendarMonth(activeStartDate);
              }}
              formatDay={(_locale, date) => String(date.getDate())}
            />
          </div>

          {selectedDate && (
            <div className="date-events-panel">
              <h3>{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 행사</h3>
              {eventsOnSelectedDate.length === 0 ? (
                <p className="empty-message">이 날은 예정된 행사가 없습니다.</p>
              ) : (
                eventsOnSelectedDate.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="date-event-item"
                    onClick={() => setOpenEventId(event.id)}
                  >
                    <span className="upcoming-event-icon">{EVENT_TYPE_ICONS[event.event_type]}</span>
                    <div className="upcoming-event-info">
                      <div className="upcoming-event-title">{event.title}</div>
                      <div className="upcoming-event-meta">
                        {formatEventDate(event.starts_at)}
                        {event.category_text && ` · ${event.category_text}`}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {events.length === 0 && (
            <div className="empty-state">
              <p>등록된 행사가 없습니다.</p>
              {isManager && <p>위 "+ 행사 등록" 버튼으로 첫 행사를 만들어보세요.</p>}
            </div>
          )}
        </>
      )}

      {openEventId && (
        <EventDetailSheet
          eventId={openEventId}
          userId={userId}
          isManager={isManager}
          onClose={() => setOpenEventId(null)}
          onChanged={loadEvents}
        />
      )}

      {showCreateSheet && (
        <CreateEventSheet
          clubId={clubId}
          userId={userId}
          onClose={() => setShowCreateSheet(false)}
          onCreated={() => {
            setShowCreateSheet(false);
            loadEvents();
          }}
        />
      )}
    </div>
  );
};
