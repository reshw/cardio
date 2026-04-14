import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WorkoutFeedCard } from './WorkoutFeedCard';
import { useAuth } from '../contexts/AuthContext';
import type { WorkoutFeedItem } from '../services/feedService';

interface Props {
  clubId: string;
  clubName: string;
  selectedDate: Date;
  feedItems: WorkoutFeedItem[];
  loading: boolean;
  onDateChange: (days: number) => void;
  onDateSelect: (date: Date) => void;
  onOptimisticLike: (workoutId: string, isLiked: boolean) => void;
  onOptimisticCommentAdd: (workoutId: string) => void;
  onOptimisticCommentDelete: (workoutId: string) => void;
  onBlock: (userId: string) => void;
  onMemberClick: (userId: string, userName: string) => void;
}

export const WorkoutFeed = ({
  clubId,
  clubName,
  selectedDate,
  feedItems,
  loading,
  onDateChange,
  onDateSelect,
  onOptimisticLike,
  onOptimisticCommentAdd,
  onOptimisticCommentDelete,
  onBlock,
  onMemberClick,
}: Props) => {
  const { user } = useAuth();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = new Date(selectedDate).setHours(0, 0, 0, 0) === today.getTime();

  const formatDate = (date: Date) => {
    if (isToday) return '오늘';
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const toInputValue = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split('-').map(Number);
    const picked = new Date(y, m - 1, d);
    onDateSelect(picked);
  };

  return (
    <div className="workout-feed-container">
      {/* 날짜 네비게이션 */}
      <div className="feed-date-navigation">
        <button className="date-nav-button" onClick={() => onDateChange(-1)}>
          <ChevronLeft size={20} />
        </button>

        <div
          className="feed-date-display"
          onClick={() => dateInputRef.current?.showPicker?.()}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          {formatDate(selectedDate)}
          <input
            ref={dateInputRef}
            type="date"
            value={toInputValue(selectedDate)}
            max={toInputValue(today)}
            onChange={handleDateInputChange}
            style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', top: 0, left: 0, pointerEvents: 'none' }}
          />
        </div>

        <button className="date-nav-button" onClick={() => onDateChange(1)} disabled={isToday}>
          <ChevronRight size={20} />
        </button>

        {!isToday && (
          <button className="date-nav-today-btn" onClick={() => onDateSelect(new Date())}>
            오늘
          </button>
        )}
      </div>

      {/* 피드 리스트 */}
      {loading ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>피드 불러오는 중...</p>
        </div>
      ) : feedItems.length === 0 ? (
        <div className="empty-state">
          <p>이 날은 운동 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="feed-items">
          {(() => {
            // 내 운동과 다른 사람 운동 분리
            const myWorkouts = feedItems.filter(item => item.workout.user_id === user?.id);
            const othersWorkouts = feedItems.filter(item => item.workout.user_id !== user?.id);

            return (
              <>
                {/* 내 운동 그룹 */}
                {myWorkouts.map((item) => (
                  <WorkoutFeedCard
                    key={item.workout.id}
                    item={item}
                    clubId={clubId}
                    clubName={clubName}
                    onOptimisticLike={onOptimisticLike}
                    onOptimisticCommentAdd={onOptimisticCommentAdd}
                    onOptimisticCommentDelete={onOptimisticCommentDelete}
                    onBlock={onBlock}
                    onMemberClick={onMemberClick}
                  />
                ))}

                {/* 구분선 (내 운동이 있고, 다른 사람 운동도 있을 때만) */}
                {myWorkouts.length > 0 && othersWorkouts.length > 0 && (
                  <div className="feed-divider">
                    <span className="feed-divider-text">다른 멤버</span>
                  </div>
                )}

                {/* 다른 사람 운동 그룹 */}
                {othersWorkouts.map((item) => (
                  <WorkoutFeedCard
                    key={item.workout.id}
                    item={item}
                    clubId={clubId}
                    clubName={clubName}
                    onOptimisticLike={onOptimisticLike}
                    onOptimisticCommentAdd={onOptimisticCommentAdd}
                    onOptimisticCommentDelete={onOptimisticCommentDelete}
                    onBlock={onBlock}
                    onMemberClick={onMemberClick}
                  />
                ))}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
