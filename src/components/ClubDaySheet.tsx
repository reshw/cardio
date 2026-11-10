import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { useModalHistory } from '../hooks/useModalHistory';
import clubService from '../services/clubService';
import type { WorkoutFeedItem } from '../services/feedService';
import {
  EVENT_TYPE_ICONS,
  EVENT_TYPE_LABELS,
  type ClubEvent,
  type EventPhotoSummary,
} from '../services/clubEventService';
import { WorkoutFeed } from './WorkoutFeed';
import { FeedDateNav } from './FeedDateNav';
import { EventDetailContent } from './EventDetailContent';
import { CreateEventSheet } from './CreateEventSheet';

export type DaySheetTab = 'workout' | 'event';

interface Props {
  clubId: string;
  clubName: string;
  viewerUserId: string;
  isManager: boolean;
  /** 행사 기능 on/off. 꺼져 있으면 탭 없이 운동만, 날짜 이동도 오늘까지만 */
  eventsEnabled: boolean;
  initialDate: Date;
  /** 생략하면 그날 행사가 있을 때 '행사', 없으면 '운동' */
  initialTab?: DaySheetTab;
  /** 달력에 걸린 필터 — 운동 탭 안에서만 적용된다 (행사는 사람·종목 체계가 없다) */
  filterUserId: string | null;
  filterCategory: string | null;
  /** 필터 안내 문구 (예: "홍길동 · 수영"). 필터가 없으면 null */
  filterLabel: string | null;
  enabledCategorySet: Set<string>;
  /** 이 클럽의 행사 전체 (행사 기능 꺼진 클럽은 빈 배열) */
  events: ClubEvent[];
  photoSummaries: Record<string, EventPhotoSummary>;
  onMemberClick: (userId: string, userName: string) => void;
  /** 시트 안에서 누군가를 차단하면 달력 숫자도 다시 세야 한다 */
  onBlocked: () => void;
  /** 행사 등록/수정/삭제/사진 변경 후 달력의 행사 목록을 다시 불러온다 */
  onEventsChanged: () => void;
  onClose: () => void;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

const dayStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a: Date, b: Date) => dayStart(a).getTime() === dayStart(b).getTime();

// 클럽달력에서 날짜를 누르면 뜨는 시트 — [운동 N] [행사 M] 탭.
// 운동 탭은 오늘운동 탭의 WorkoutFeed 를 그대로 재사용한다 (WorkoutFeed 는 이름과 달리
// selectedDate 를 받아 그 날짜를 보여주는 컴포넌트다). 날짜 이동은 두 탭이 공유하므로
// WorkoutFeed 안이 아니라 시트 상단(FeedDateNav)에 둔다.
//
// 좋아요/댓글/차단 상태는 시트 안에서만 관리한다. 오늘운동 탭의 피드 캐시와 섞으면
// 날짜·필터가 다른 목록끼리 서로 덮어쓰게 된다.
// 계획: docs/plans/club-calendar-day-sheet.md
export const ClubDaySheet = ({
  clubId,
  clubName,
  viewerUserId,
  isManager,
  eventsEnabled,
  initialDate,
  initialTab,
  filterUserId,
  filterCategory,
  filterLabel,
  enabledCategorySet,
  events,
  photoSummaries,
  onMemberClick,
  onBlocked,
  onEventsChanged,
  onClose,
}: Props) => {
  useModalHistory(true, onClose);

  const [date, setDate] = useState(initialDate);
  const [items, setItems] = useState<WorkoutFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventsOfDay = useMemo(
    () => events.filter((e) => sameDay(new Date(e.starts_at), date)),
    [events, date]
  );

  // 행사가 하나도 없는 클럽에서 일반 멤버에게 "행사 0" 탭은 소음이다 — 운영진만 등록 진입점으로 남긴다
  const showTabs = eventsEnabled && (events.length > 0 || isManager);

  const [tab, setTab] = useState<DaySheetTab>(() => {
    if (!showTabs) return 'workout';
    if (initialTab) return initialTab;
    return events.some((e) => sameDay(new Date(e.starts_at), initialDate)) ? 'event' : 'workout';
  });
  const activeTab: DaySheetTab = showTabs ? tab : 'workout';

  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const isFuture = dayStart(date).getTime() > dayStart(new Date()).getTime();

  const load = useCallback(async () => {
    // 아직 안 온 날은 운동 기록이 있을 수 없다 — 요청하지 않는다
    if (isFuture) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await clubService.getClubWorkoutFeed(clubId, date, viewerUserId);
      const filtered = raw
        .filter((it) => !filterUserId || it.workout.user_id === filterUserId)
        .filter((it) => !filterCategory || it.workout.category === filterCategory)
        .map((it) => {
          // 오늘운동 탭과 같은 규칙으로 비활성 종목 표시 (Club.tsx 피드 렌더부와 동일)
          const key = it.workout.sub_type ? `${it.workout.category}-${it.workout.sub_type}` : it.workout.category;
          return { ...it, is_disabled: enabledCategorySet.size > 0 && !enabledCategorySet.has(key) };
        });
      setItems(filtered);
    } catch (err: any) {
      console.error('[클럽달력] 날짜별 피드 로드 실패 상세:', JSON.stringify(err), err);
      setError(err?.message || err?.details || err?.hint || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }, [clubId, date, isFuture, viewerUserId, filterUserId, filterCategory, enabledCategorySet]);

  useEffect(() => { load(); }, [load]);

  const moveTo = (next: Date) => {
    setDate(next);
    setDetailEventId(null);
  };
  const changeDate = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    moveTo(next);
  };
  const changeTab = (next: DaySheetTab) => {
    setTab(next);
    setDetailEventId(null);
  };

  const patch = (workoutId: string, fn: (it: WorkoutFeedItem) => WorkoutFeedItem) =>
    setItems((prev) => prev.map((it) => (it.workout.id === workoutId ? fn(it) : it)));

  // 행사 탭: 1건이면 목록을 건너뛰고 바로 상세, 2건 이상이면 목록 → 상세를 시트 안에서 전환
  const activeEventId =
    detailEventId && eventsOfDay.some((e) => e.id === detailEventId)
      ? detailEventId
      : eventsOfDay.length === 1
        ? eventsOfDay[0].id
        : null;
  const inListDetail = activeTab === 'event' && eventsOfDay.length >= 2 && activeEventId !== null;

  // 안드로이드 뒤로가기: 상세에서는 목록으로, 목록에서는 시트 닫기.
  // 목록↔상세 전환용 히스토리 엔트리는 상세에 있는 동안만 둔다.
  const closeAfterBackRef = useRef(false);
  useModalHistory(inListDetail, () => {
    setDetailEventId(null);
    if (closeAfterBackRef.current) {
      closeAfterBackRef.current = false;
      onClose();
    }
  });

  // 상세 단계에서 ✕/배경으로 시트를 통째로 닫으면 두 엔트리 중 하나가 남아 뒤로가기를
  // 한 번 더 눌러야 하는 유령 엔트리가 생긴다. 상세 엔트리를 먼저 pop 한 뒤 닫는다.
  const requestClose = () => {
    if (inListDetail) {
      closeAfterBackRef.current = true;
      history.back();
    } else {
      onClose();
    }
  };

  const title = `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_KO[date.getDay()]})`;

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); requestClose(); }}>
      <div className="feedback-sheet day-feed-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">{title}</span>
          <button className="race-modal-close" type="button" onClick={requestClose}>✕</button>
        </div>

        {/* 날짜 이동 + 탭 — 스크롤해도 헤더 아래에 고정 (바텀시트 가이드 4절) */}
        <div className="day-sheet-sticky">
          <FeedDateNav
            date={date}
            onChange={changeDate}
            onSelect={moveTo}
            maxDate={eventsEnabled ? undefined : new Date()}
          />
          {showTabs && (
            <div className="ranking-filter-tabs day-sheet-tabs">
              <button
                type="button"
                className={`filter-tab ${activeTab === 'workout' ? 'active' : ''}`}
                onClick={() => changeTab('workout')}
              >
                운동{!loading && !isFuture && ` ${items.length}`}
              </button>
              <button
                type="button"
                className={`filter-tab ${activeTab === 'event' ? 'active' : ''}`}
                onClick={() => changeTab('event')}
              >
                행사 {eventsOfDay.length}
              </button>
            </div>
          )}
        </div>

        {activeTab === 'workout' && (
          <>
            {filterLabel && <div className="day-sheet-filter-note">{filterLabel} 필터 중</div>}
            {isFuture ? (
              <div className="empty-state"><p>아직 오지 않은 날이에요.</p></div>
            ) : error ? (
              <div className="empty-state">
                <p>운동 기록을 불러오지 못했습니다.</p>
                <p className="club-calendar-error-detail">{error}</p>
              </div>
            ) : (
              <WorkoutFeed
                clubId={clubId}
                clubName={clubName}
                selectedDate={date}
                feedItems={items}
                loading={loading}
                showDateNav={false}
                onOptimisticLike={(id, isLiked) =>
                  patch(id, (it) => ({
                    ...it,
                    like_count: isLiked ? it.like_count - 1 : it.like_count + 1,
                    is_liked_by_me: !isLiked,
                  }))
                }
                onOptimisticCommentAdd={(id) => patch(id, (it) => ({ ...it, comment_count: it.comment_count + 1 }))}
                onOptimisticCommentDelete={(id) =>
                  patch(id, (it) => ({ ...it, comment_count: Math.max(0, it.comment_count - 1) }))
                }
                onBlock={(blockedUserId) => {
                  setItems((prev) => prev.filter((it) => it.workout.user_id !== blockedUserId));
                  onBlocked();
                }}
                onMemberClick={onMemberClick}
              />
            )}
          </>
        )}

        {activeTab === 'event' && (
          <>
            {eventsOfDay.length === 0 && (
              <div className="empty-state">
                <p>이 날은 행사가 없습니다.</p>
                {isManager && (
                  <button type="button" className="club-calendar-add-btn day-sheet-create-btn" onClick={() => setShowCreate(true)}>
                    + 이 날짜로 행사 등록
                  </button>
                )}
              </div>
            )}

            {eventsOfDay.length >= 2 && activeEventId === null && (
              <div className="day-event-list">
                {eventsOfDay.map((ev) => {
                  const photos = photoSummaries[ev.id]?.count ?? 0;
                  return (
                    <button key={ev.id} type="button" className="upcoming-event-card" onClick={() => setDetailEventId(ev.id)}>
                      <span className="upcoming-event-icon">{EVENT_TYPE_ICONS[ev.event_type]}</span>
                      <div className="upcoming-event-info">
                        <div className="upcoming-event-title">{ev.title}</div>
                        <div className="upcoming-event-meta">
                          {ev.category_text || EVENT_TYPE_LABELS[ev.event_type]}
                          {photos > 0 && ` · 사진 ${photos}장`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeEventId !== null && (
              <>
                {inListDetail && (
                  <button type="button" className="day-sheet-back-btn" onClick={() => setDetailEventId(null)}>
                    <ChevronLeft size={16} /> 목록
                  </button>
                )}
                <EventDetailContent
                  eventId={activeEventId}
                  userId={viewerUserId}
                  isManager={isManager}
                  onChanged={onEventsChanged}
                  onDeleted={() => setDetailEventId(null)}
                />
              </>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateEventSheet
          clubId={clubId}
          userId={viewerUserId}
          initialDate={date}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            onEventsChanged();
          }}
        />
      )}
    </div>,
    document.body
  );
};
