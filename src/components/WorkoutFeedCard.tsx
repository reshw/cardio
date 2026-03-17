import { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';
import { CommentSection } from './CommentSection';
import type { WorkoutFeedItem } from '../services/feedService';

interface Props {
  item: WorkoutFeedItem;
  clubId: string;
  onOptimisticLike: (workoutId: string, isLiked: boolean) => void;
  onOptimisticCommentAdd: (workoutId: string) => void;
  onOptimisticCommentDelete: (workoutId: string) => void;
}

export const WorkoutFeedCard = ({
  item,
  clubId,
  onOptimisticLike,
  onOptimisticCommentAdd,
  onOptimisticCommentDelete,
}: Props) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

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

  const getIntensityLabel = (intensity: number) => {
    if (intensity <= 2) return '편안';
    if (intensity <= 4) return '경쾌';
    if (intensity <= 6) return '자극';
    if (intensity <= 8) return '고강도';
    return '한계돌파';
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 2) return '#4ade80'; // green
    if (intensity <= 4) return '#22c55e'; // green
    if (intensity <= 6) return '#eab308'; // yellow
    if (intensity <= 8) return '#f97316'; // orange
    if (intensity === 9) return '#ef4444'; // red
    return '#dc2626'; // dark red
  };

  const handleLikeToggle = async () => {
    if (!user || liking) return;

    setLiking(true);

    // Optimistic Update: UI 즉시 업데이트
    onOptimisticLike(workout.id, item.is_liked_by_me);

    try {
      // 백그라운드로 DB 업데이트
      await feedService.toggleLike(workout.id, clubId, user.id, item.is_liked_by_me);
    } catch (error) {
      console.error('좋아요 토글 실패:', error);
      // 실패 시 롤백
      onOptimisticLike(workout.id, !item.is_liked_by_me);
      alert('좋아요 처리에 실패했습니다.');
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="feed-card">
      {/* 사용자 정보 */}
      <div className="feed-card-header" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
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
      <div className="feed-card-body" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
        <div className="feed-workout-header">
          <div className="feed-workout-type">{getWorkoutLabel()}</div>
          <div
            className="feed-intensity-badge"
            style={{ backgroundColor: getIntensityColor(workout.intensity) }}
          >
            {getIntensityLabel(workout.intensity)}
          </div>
        </div>
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
      {showComments && (
        <CommentSection
          workoutId={workout.id}
          clubId={clubId}
          onCommentAdded={() => onOptimisticCommentAdd(workout.id)}
          onCommentDeleted={() => onOptimisticCommentDelete(workout.id)}
        />
      )}

      {/* 상세보기 모달 */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-content workout-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>운동 상세</h2>
              <button className="modal-close" onClick={() => setShowDetail(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="workout-detail-section">
                <h3>운동 정보</h3>
                <div className="workout-detail-info">
                  <div className="workout-detail-row">
                    <span className="label">종류</span>
                    <span className="value">{getWorkoutLabel()}</span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">거리/시간</span>
                    <span className="value">
                      {workout.value} {workout.unit}
                    </span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">체감 난이도</span>
                    <span
                      className="value intensity-value"
                      style={{ color: getIntensityColor(workout.intensity) }}
                    >
                      {getIntensityLabel(workout.intensity)}
                    </span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">마일리지</span>
                    <span className="value">{workout.mileage.toFixed(1)}</span>
                  </div>
                  <div className="workout-detail-row">
                    <span className="label">시간</span>
                    <span className="value">
                      {new Date(workout.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>

              {workout.proof_image && (
                <div className="workout-detail-section">
                  <h3>인증 사진</h3>
                  <div className="workout-detail-image">
                    <img src={workout.proof_image} alt="운동 인증" />
                  </div>
                </div>
              )}

              <div className="workout-detail-section">
                <h3>기록자</h3>
                <div className="workout-detail-user">
                  {item.user_profile_image ? (
                    <img src={item.user_profile_image} alt={item.user_display_name} />
                  ) : (
                    <div className="user-avatar-placeholder">{item.user_display_name[0]}</div>
                  )}
                  <span>{item.user_display_name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
