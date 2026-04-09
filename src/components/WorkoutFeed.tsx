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
  onOptimisticLike,
  onOptimisticCommentAdd,
  onOptimisticCommentDelete,
  onBlock,
  onMemberClick,
}: Props) => {
  const { user } = useAuth();
  const formatDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate.getTime() === today.getTime()) {
      return '오늘';
    }

    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  return (
    <div className="workout-feed-container">
      {/* 날짜 네비게이션 */}
      <div className="feed-date-navigation">
        <button className="date-nav-button" onClick={() => onDateChange(-1)}>
          <ChevronLeft size={20} />
        </button>

        <div className="feed-date-display">{formatDate(selectedDate)}</div>

        <button className="date-nav-button" onClick={() => onDateChange(1)}>
          <ChevronRight size={20} />
        </button>
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
