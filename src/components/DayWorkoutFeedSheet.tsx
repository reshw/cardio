import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import clubService from '../services/clubService';
import type { WorkoutFeedItem } from '../services/feedService';
import { EVENT_TYPE_ICONS, type ClubEvent } from '../services/clubEventService';
import { WorkoutFeed } from './WorkoutFeed';

interface Props {
  clubId: string;
  clubName: string;
  viewerUserId: string;
  initialDate: Date;
  /** 달력에 걸린 필터 — 시트 안에서도 그대로 핀셋한다 */
  filterUserId: string | null;
  filterCategory: string | null;
  /** 헤더 제목 (예: "홍길동 · 수영"). 필터가 없으면 "운동 기록" */
  title: string;
  enabledCategorySet: Set<string>;
  /** 그날 행사 (행사 기능 꺼진 클럽은 항상 빈 배열) */
  eventsForDate: (date: Date) => ClubEvent[];
  onOpenEvent: (eventId: string) => void;
  onMemberClick: (userId: string, userName: string) => void;
  /** 시트 안에서 누군가를 차단하면 달력 숫자도 다시 세야 한다 */
  onBlocked: () => void;
  onClose: () => void;
}

// 클럽달력에서 날짜를 누르면 뜨는 시트. 오늘운동 탭의 WorkoutFeed 를 그대로 재사용한다 —
// WorkoutFeed 는 이름과 달리 selectedDate 를 받아 그 날짜를 보여주는 컴포넌트다.
//
// 좋아요/댓글/차단 상태는 시트 안에서만 관리한다. 오늘운동 탭의 피드 캐시와 섞으면
// 날짜·필터가 다른 목록끼리 서로 덮어쓰게 된다.
export const DayWorkoutFeedSheet = ({
  clubId,
  clubName,
  viewerUserId,
  initialDate,
  filterUserId,
  filterCategory,
  title,
  enabledCategorySet,
  eventsForDate,
  onOpenEvent,
  onMemberClick,
  onBlocked,
  onClose,
}: Props) => {
  useModalHistory(true, onClose);
  const [date, setDate] = useState(initialDate);
  const [items, setItems] = useState<WorkoutFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
  }, [clubId, date, viewerUserId, filterUserId, filterCategory, enabledCategorySet]);

  useEffect(() => { load(); }, [load]);

  const changeDate = (days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    setDate(next);
  };

  const patch = (workoutId: string, fn: (it: WorkoutFeedItem) => WorkoutFeedItem) =>
    setItems((prev) => prev.map((it) => (it.workout.id === workoutId ? fn(it) : it)));

  const events = eventsForDate(date);

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet day-feed-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">{title}</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        {events.length > 0 && (
          <div className="day-feed-events">
            {events.map((ev) => (
              <button key={ev.id} type="button" className="day-feed-event-chip" onClick={() => onOpenEvent(ev.id)}>
                <span>{EVENT_TYPE_ICONS[ev.event_type]}</span>
                <span className="day-feed-event-title">{ev.title}</span>
              </button>
            ))}
          </div>
        )}

        {error ? (
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
            onDateChange={changeDate}
            onDateSelect={setDate}
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
      </div>
    </div>,
    document.body
  );
};
