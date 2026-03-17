import { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';
import { CommentSection } from './CommentSection';
import type { WorkoutFeedItem } from '../services/feedService';

interface Props {
  item: WorkoutFeedItem;
  clubId: string;
  onUpdate: () => void;
}

export const WorkoutFeedCard = ({ item, clubId, onUpdate }: Props) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);

  const { workout } = item;

  const getWorkoutLabel = () => {
    if (workout.sub_type) {
      return `${workout.category} - ${workout.sub_type}`;
    }
    return workout.category;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleLikeToggle = async () => {
    if (!user || liking) return;

    setLiking(true);
    try {
      await feedService.toggleLike(workout.id, clubId, user.id, item.is_liked_by_me);
      onUpdate(); // 피드 새로고침
    } catch (error) {
      console.error('좋아요 토글 실패:', error);
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="feed-card">
      {/* 사용자 정보 */}
      <div className="feed-card-header">
        {item.user_profile_image ? (
          <img src={item.user_profile_image} alt={item.user_display_name} className="feed-user-avatar" />
        ) : (
          <div className="feed-user-avatar-placeholder">{item.user_display_name[0]}</div>
        )}
        <div className="feed-user-info">
          <div className="feed-user-name">{item.user_display_name}</div>
          <div className="feed-time">{formatTime(workout.created_at)}</div>
        </div>
      </div>

      {/* 운동 정보 */}
      <div className="feed-card-body">
        <div className="feed-workout-type">{getWorkoutLabel()}</div>
        <div className="feed-workout-value">
          {workout.value} {workout.unit}
        </div>
      </div>

      {/* 좋아요/댓글 버튼 */}
      <div className="feed-card-actions">
        <button
          className={`feed-action-button ${item.is_liked_by_me ? 'liked' : ''}`}
          onClick={handleLikeToggle}
          disabled={liking}
        >
          <Heart size={18} fill={item.is_liked_by_me ? 'currentColor' : 'none'} />
          <span>{item.like_count}</span>
        </button>

        <button className="feed-action-button" onClick={() => setShowComments(!showComments)}>
          <MessageCircle size={18} />
          <span>{item.comment_count}</span>
        </button>
      </div>

      {/* 댓글 섹션 */}
      {showComments && <CommentSection workoutId={workout.id} clubId={clubId} onCommentAdded={onUpdate} />}
    </div>
  );
};
