import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WorkoutFeedCard } from './WorkoutFeedCard';
import type { WorkoutFeedItem } from '../services/feedService';

interface Props {
  clubId: string;
  selectedDate: Date;
  feedItems: WorkoutFeedItem[];
  loading: boolean;
  onDateChange: (days: number) => void;
  onRefresh: () => void;
}

export const WorkoutFeed = ({
  clubId,
  selectedDate,
  feedItems,
  loading,
  onDateChange,
  onRefresh,
}: Props) => {
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
          {feedItems.map((item) => (
            <WorkoutFeedCard key={item.workout.id} item={item} clubId={clubId} onUpdate={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
};
