import { useEffect, useMemo, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import { User, Filter, X } from 'lucide-react';
import clubEventService, { type ClubEvent, type EventPhotoSummary, EVENT_TYPE_ICONS } from '../services/clubEventService';
import clubService from '../services/clubService';
import type { ClubMember } from '../services/clubService';
import { EventDetailSheet } from './EventDetailSheet';
import { CreateEventSheet } from './CreateEventSheet';
import { MemberPickerSheet } from './MemberPickerSheet';
import { ClubDaySheet, type DaySheetTab } from './ClubDaySheet';
import { ClubCalendarToday } from './ClubCalendarToday';
import { UpcomingEventsSection, PastEventsSection } from './ClubEventLists';

interface Props {
  clubId: string;
  clubName: string;
  userId: string;
  isManager: boolean;
  /** 행사 기능 on/off (opt-out). 꺼져 있어도 탭과 운동 갯수는 보인다 */
  eventsEnabled: boolean;
  /** 마일리지 랭킹의 종목 필터와 같은 목록 (Club.tsx 에서 이미 로드됨) */
  categoryOptions: { category: string; keys: string[] }[];
  enabledCategorySet: Set<string>;
  onMemberClick: (userId: string, userName: string) => void;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// get_club_workout_day_counts 가 돌려주는 'YYYY-MM-DD' 와 같은 형식
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 클럽 닉네임만 — 본명(users.display_name)은 노출하지 않는다 (MemberPickerSheet 주석 참고)
const memberName = (m: ClubMember) => m.club_nickname || '(닉네임 없음)';

export const ClubCalendarTab = ({
  clubId,
  clubName,
  userId,
  isManager,
  eventsEnabled,
  categoryOptions,
  enabledCategorySet,
  onMemberClick,
}: Props) => {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  // 날짜별 운동 갯수 + 핀셋 필터 (마일리지 랭킹의 사람 검색·종목 필터와 같은 개념)
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});
  const [countsError, setCountsError] = useState<string | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [daySheet, setDaySheet] = useState<{ date: Date; tab?: DaySheetTab } | null>(null);
  const [photoSummaries, setPhotoSummaries] = useState<Record<string, EventPhotoSummary>>({});
  const [todayWorkoutCount, setTodayWorkoutCount] = useState<number | null>(null);
  const [countsVersion, setCountsVersion] = useState(0); // 차단 등으로 다시 세야 할 때 올린다

  // 다시 불러올 때(사진·수정 직후 등)는 로딩 표시를 켜지 않는다 — 섹션이 깜빡이며 사라지는 걸 막는다
  const loadedOnceRef = useRef(false);
  const loadEvents = async () => {
    if (!eventsEnabled) return;
    if (!loadedOnceRef.current) setEventsLoading(true);
    try {
      const data = await clubEventService.listEvents(clubId);
      setEvents(data);
      setEventsError(null);
      loadedOnceRef.current = true;
      clubEventService
        .listEventPhotoSummaries(data.map((e) => e.id))
        .then(setPhotoSummaries)
        .catch((err: any) => {
          console.error('[클럽달력] 행사 사진 요약 로드 실패:', JSON.stringify(err), err);
        });
    } catch (err: any) {
      console.error('[클럽달력] 행사 목록 로드 실패:', JSON.stringify(err), err);
      setEventsError(err?.message || err?.error_description || err?.hint || JSON.stringify(err));
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    loadedOnceRef.current = false;
    setPhotoSummaries({});
    if (eventsEnabled) loadEvents();
    else setEvents([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, eventsEnabled]);

  // 클럽이 바뀌면 이전 클럽의 사람 필터는 무효 (그 사람이 없을 수 있다)
  useEffect(() => {
    setFilterUserId(null);
    setFilterCategory(null);
    clubService
      .getClubMembers(clubId)
      // 피드에 안 보이기로 한 멤버는 달력에서도 고를 수 없게 한다 (숫자 집계 규칙과 동일)
      .then((list) => setMembers(list.filter((m) => m.show_in_feed !== false)))
      .catch((err: any) => {
        console.error('[클럽달력] 멤버 목록 로드 실패:', JSON.stringify(err), err);
      });
  }, [clubId]);

  useEffect(() => {
    let cancelled = false;
    setCountsError(null);
    clubService
      .getWorkoutDayCounts(clubId, calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, {
        userId: filterUserId,
        category: filterCategory,
      })
      .then((map) => { if (!cancelled) setDayCounts(map); })
      .catch((err: any) => {
        if (cancelled) return;
        setDayCounts({});
        setCountsError(err?.message || JSON.stringify(err));
      });
    return () => { cancelled = true; };
  }, [clubId, calendarMonth, filterUserId, filterCategory, countsVersion]);

  // 오늘 카드의 운동 횟수 — 달력의 dayCounts 는 사람·종목 필터와 보고 있는 달에 묶여 있어 못 쓴다
  useEffect(() => {
    let cancelled = false;
    setTodayWorkoutCount(null);
    const now = new Date();
    clubService
      .getWorkoutDayCounts(clubId, now.getFullYear(), now.getMonth() + 1)
      .then((map) => { if (!cancelled) setTodayWorkoutCount(map[isoDay(now)] ?? 0); })
      .catch((err: any) => {
        console.error('[클럽달력] 오늘 운동 갯수 조회 실패:', JSON.stringify(err), err);
      });
    return () => { cancelled = true; };
  }, [clubId, countsVersion]);

  // 오늘 행사 / 오늘 이후 행사 / 사진 있는 지난 행사 (오늘 행사는 맨 위 카드로 올라가므로 목록에서 뺀다)
  const { todayEvents, upcomingEvents, pastAlbum } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOf = (e: ClubEvent) => {
      const d = new Date(e.starts_at);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };
    return {
      todayEvents: events.filter((e) => dayOf(e) === todayStart),
      upcomingEvents: events.filter((e) => dayOf(e) > todayStart),
      pastAlbum: events
        .filter((e) => dayOf(e) < todayStart && photoSummaries[e.id])
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
        .map((e) => ({ event: e, summary: photoSummaries[e.id] })),
    };
  }, [events, photoSummaries]);

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

  const filterMember = filterUserId ? members.find((m) => m.user_id === filterUserId) : undefined;
  const filterLabel = [filterMember ? memberName(filterMember) : null, filterCategory].filter(Boolean).join(' · ') || null;

  return (
    <div className="club-calendar-tab">
      <ClubCalendarToday
        todayEvents={todayEvents}
        workoutCount={todayWorkoutCount}
        photoCount={todayEvents[0] ? photoSummaries[todayEvents[0].id]?.count ?? 0 : 0}
        onOpen={(tab) => setDaySheet({ date: new Date(), tab })}
      />

      {eventsEnabled && eventsError && (
        <div className="empty-state">
          <p>행사를 불러오지 못했습니다.</p>
          <p className="club-calendar-error-detail">{eventsError}</p>
        </div>
      )}

      {eventsEnabled && !eventsLoading && !eventsError && (upcomingEvents.length > 0 || isManager) && (
        <UpcomingEventsSection
          events={upcomingEvents}
          hasAnyEvent={events.length > 0}
          isManager={isManager}
          onOpen={setOpenEventId}
          onCreate={() => setShowCreateSheet(true)}
        />
      )}

      {/* 핀셋 필터 — 같은 달력의 숫자가 이 조건으로 좁혀진다 */}
      <div className="club-calendar-filters">
        <button
          type="button"
          className={`club-calendar-filter-chip${filterUserId ? ' active' : ''}`}
          onClick={() => setShowMemberPicker(true)}
        >
          <User size={14} />
          <span>{filterMember ? memberName(filterMember) : '사람'}</span>
          {filterUserId && (
            <span
              role="button"
              aria-label="사람 필터 해제"
              className="club-calendar-filter-clear"
              onClick={(e) => { e.stopPropagation(); setFilterUserId(null); }}
            >
              <X size={13} />
            </span>
          )}
        </button>

        {categoryOptions.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={`club-calendar-filter-chip${filterCategory ? ' active' : ''}`}
              onClick={() => setShowCategoryMenu((v) => !v)}
            >
              <Filter size={14} />
              <span>{filterCategory ?? '종목'}</span>
              {filterCategory && (
                <span
                  role="button"
                  aria-label="종목 필터 해제"
                  className="club-calendar-filter-clear"
                  onClick={(e) => { e.stopPropagation(); setFilterCategory(null); setShowCategoryMenu(false); }}
                >
                  <X size={13} />
                </span>
              )}
            </button>
            {/* <select> 대신 커스텀 메뉴 — cardio-android WebView 에서 select 드롭다운이 조용히 실패한다 */}
            {showCategoryMenu && (
              <>
                <div className="club-calendar-menu-backdrop" onClick={() => setShowCategoryMenu(false)} />
                <div className="club-calendar-menu">
                  <button
                    type="button"
                    className={`club-calendar-menu-item${filterCategory === null ? ' selected' : ''}`}
                    onClick={() => { setFilterCategory(null); setShowCategoryMenu(false); }}
                  >
                    전체 종목
                  </button>
                  {categoryOptions.map((opt) => (
                    <button
                      key={opt.category}
                      type="button"
                      className={`club-calendar-menu-item${filterCategory === opt.category ? ' selected' : ''}`}
                      onClick={() => { setFilterCategory(opt.category); setShowCategoryMenu(false); }}
                    >
                      {opt.category}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

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
            if (date.getDay() === 0) classes.push('is-sunday');
            if (date.getDay() === 6) classes.push('is-saturday');
            return classes.join(' ') || null;
          }}
          tileContent={({ date, view }) => {
            if (view !== 'month') return null;
            const n = dayCounts[isoDay(date)];
            const firstEvent = eventsByDateKey.get(dateKey(date))?.[0];
            return (
              <>
                {firstEvent && <span className="cal-event-icon">{EVENT_TYPE_ICONS[firstEvent.event_type]}</span>}
                {/* 0 은 안 찍는다 — 빈 칸은 그냥 빈 칸. "안 한 날"을 도드라지게 만들지 않는다 */}
                {n ? <span className="cal-workout-count">{n}</span> : null}
              </>
            );
          }}
          onClickDay={(date) => setDaySheet({ date })}
          onActiveStartDateChange={({ activeStartDate }) => {
            if (activeStartDate) setCalendarMonth(activeStartDate);
          }}
          formatDay={(_locale, date) => String(date.getDate())}
        />
        {countsError && (
          <p className="club-calendar-error-detail" style={{ marginTop: 8 }}>
            운동 갯수를 불러오지 못했습니다: {countsError}
          </p>
        )}
      </div>

      {eventsEnabled && !eventsLoading && pastAlbum.length > 0 && (
        <PastEventsSection items={pastAlbum} onOpen={setOpenEventId} />
      )}

      {showMemberPicker && (
        <MemberPickerSheet
          title="사람으로 보기"
          members={members}
          onSelect={(id) => setFilterUserId(id)}
          onClose={() => setShowMemberPicker(false)}
        />
      )}

      {daySheet && (
        <ClubDaySheet
          clubId={clubId}
          clubName={clubName}
          viewerUserId={userId}
          isManager={isManager}
          eventsEnabled={eventsEnabled}
          initialDate={daySheet.date}
          initialTab={daySheet.tab}
          filterUserId={filterUserId}
          filterCategory={filterCategory}
          filterLabel={filterLabel}
          enabledCategorySet={enabledCategorySet}
          events={events}
          photoSummaries={photoSummaries}
          onMemberClick={onMemberClick}
          onBlocked={() => setCountsVersion((v) => v + 1)}
          onEventsChanged={loadEvents}
          onClose={() => setDaySheet(null)}
        />
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
