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
    // 요가/복싱은 항상 "혼합"으로 표시
    if (workout.category === '요가' || workout.category === '복싱') {
      return `${workout.category}-혼합`;
    }
    if (workout.sub_type) {
      return `${workout.category}-${workout.sub_type}`;
    }
    return workout.category;
  };

  const getRatioDisplay = () => {
    if (workout.category !== '요가' && workout.category !== '복싱') {
      return null;
    }

    if (!workout.sub_type_ratios) {
      return null;
    }

    const ratios = workout.sub_type_ratios as Record<string, number>;
    const entries = Object.entries(ratios);

    if (entries.length === 0) {
      return null;
    }

    // 단일 타입 100%인 경우 비율 표시 안함
    if (entries.length === 1 && entries[0][1] === 1.0) {
      return null;
    }

    // 비율 표시
    return entries
      .map(([type, ratio]) => `${type} ${Math.round(ratio * 100)}%`)
      .join(' | ');
  };

  const renderAvatar = (profileImage: string | undefined, displayName: string, className: string) => {
    if (profileImage?.startsWith('default:')) {
      // default:color 형식 - 색상 아바타
      const color = profileImage.replace('default:', '');
      return (
        <div
          className={className}
          style={{ background: color, color: 'white' }}
        >
          {displayName[0].toUpperCase()}
        </div>
      );
    } else if (profileImage) {
      // URL 형식 - 이미지
      return <img src={profileImage} alt={displayName} className={className} />;
    } else {
      // 프로필 이미지 없음 - 기본 그라데이션
      return (
        <div
          className={className}
          style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}
        >
          {displayName[0]}
        </div>
      );
    }
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
    <div className={`feed-card ${item.is_disabled ? 'feed-card-disabled' : ''}`}>
      {/* 비활성화 배지 */}
      {item.is_disabled && (
        <div className="feed-disabled-badge">
          마일리지 미반영
        </div>
      )}

      {/* 전체 래퍼: 프사(왼쪽 2줄) + 내용(오른쪽 2줄) */}
      <div className="feed-card-wrapper">
        {/* 왼쪽: 프로필 사진 (2줄 고정) */}
        <div className="feed-avatar-wrapper">
          {renderAvatar(item.user_profile_image, item.user_display_name, item.user_profile_image ? 'feed-user-avatar-v2' : 'feed-user-avatar-placeholder-v2')}
        </div>

        {/* 오른쪽: 내용 */}
        <div className="feed-content-wrapper">
          {/* 첫째 줄: 이름 + 시간 + 운동종목 */}
          <div className="feed-header-line" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
            <span className="feed-user-name-v2">{item.user_display_name}</span>
            <span className="feed-time-v2">{formatTime(workout.created_at)}</span>
            <span className="feed-workout-type-v2">{getWorkoutLabel()}</span>
          </div>

          {/* 둘째 줄: 데이터 + 강도 + 좋아요/댓글 */}
          <div className="feed-data-line">
            <div className="feed-workout-value-v2" onClick={() => setShowDetail(true)} style={{ cursor: 'pointer' }}>
              {workout.value} {workout.unit}
            </div>
            <span
              className="feed-intensity-badge-v2"
              style={{ backgroundColor: getIntensityColor(workout.intensity) }}
            >
              {getIntensityLabel(workout.intensity)}
            </span>
            <div className="feed-actions-v2">
              <button
                className={`feed-action-btn-v2 ${item.is_liked_by_me ? 'liked' : ''}`}
                onClick={handleLikeToggle}
                disabled={liking}
              >
                <Heart size={14} fill={item.is_liked_by_me ? 'currentColor' : 'none'} />
                <span>{item.like_count}</span>
              </button>

              <button className="feed-action-btn-v2" onClick={() => setShowComments(!showComments)}>
                <MessageCircle size={14} />
                <span>{item.comment_count}</span>
              </button>
            </div>
          </div>
        </div>
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
                    <span className="value">
                      {getWorkoutLabel()}
                      {getRatioDisplay() && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {getRatioDisplay()}
                        </div>
                      )}
                    </span>
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
                  {/* 마일리지는 클럽별로 다르므로 표시하지 않음 */}
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
                  {renderAvatar(item.user_profile_image, item.user_display_name, 'user-avatar-placeholder')}
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
