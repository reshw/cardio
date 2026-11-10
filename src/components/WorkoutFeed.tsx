import { WorkoutFeedCard } from './WorkoutFeedCard';
import { FeedDateNav } from './FeedDateNav';
import { useAuth } from '../contexts/AuthContext';
import type { WorkoutFeedItem } from '../services/feedService';

interface Props {
  clubId: string;
  clubName: string;
  selectedDate: Date;
  feedItems: WorkoutFeedItem[];
  loading: boolean;
  /** 날짜 이동 줄을 직접 그릴 때만 필요 (showDateNav=false 면 호출되지 않는다) */
  onDateChange?: (days: number) => void;
  onDateSelect?: (date: Date) => void;
  /** 클럽달력 날짜 시트처럼 날짜 줄을 시트 상단에 따로 두는 경우 false */
  showDateNav?: boolean;
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
  showDateNav = true,
  onOptimisticLike,
  onOptimisticCommentAdd,
  onOptimisticCommentDelete,
  onBlock,
  onMemberClick,
}: Props) => {
  const { user } = useAuth();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="workout-feed-container">
      {showDateNav && onDateChange && onDateSelect && (
        <FeedDateNav date={selectedDate} onChange={onDateChange} onSelect={onDateSelect} maxDate={today} />
      )}

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
