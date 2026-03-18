import { useState, useEffect } from 'react';
import { Reply, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';
import type { WorkoutCommentWithClub } from '../services/feedService';

interface Props {
  workoutId: string;
  highlightCommentId?: string;
  onCommentCountChange?: (count: number) => void;
}

export const IntegratedCommentSection = ({ workoutId, highlightCommentId, onCommentCountChange }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<WorkoutCommentWithClub[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; clubId: string; name: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [workoutId]);

  // 하이라이트 댓글로 스크롤
  useEffect(() => {
    if (highlightCommentId && comments.length > 0) {
      // DOM이 렌더링된 후 스크롤
      setTimeout(() => {
        const element = document.getElementById(`comment-${highlightCommentId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [highlightCommentId, comments]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await feedService.getCommentsFromAllClubsWithLikes(workoutId, user?.id);
      setComments(data);

      // 총 댓글 개수 계산 (대댓글 포함)
      const countComments = (commentList: WorkoutCommentWithClub[]): number => {
        let count = commentList.length;
        commentList.forEach((c) => {
          if (c.replies && c.replies.length > 0) {
            count += countComments(c.replies as WorkoutCommentWithClub[]);
          }
        });
        return count;
      };

      const totalCount = countComments(data);
      onCommentCountChange?.(totalCount);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !replyTo || !replyText.trim() || submitting) return;

    setSubmitting(true);
    try {
      await feedService.addComment(
        workoutId,
        replyTo.clubId,
        user.id,
        replyText,
        replyTo.id
      );
      setReplyText('');
      setReplyTo(null);
      await loadComments();
    } catch (error) {
      console.error('답글 작성 실패:', error);
      alert('답글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId: string, isLiked: boolean) => {
    if (!user) return;

    // 낙관적 업데이트: 프론트엔드 먼저 업데이트
    const updateCommentLikes = (commentList: WorkoutCommentWithClub[]) => {
      commentList.forEach((c) => {
        if (c.id === commentId) {
          c.is_liked_by_me = !isLiked;
          c.like_count = (c.like_count || 0) + (isLiked ? -1 : 1);
        }
        if (c.replies && c.replies.length > 0) {
          updateCommentLikes(c.replies as WorkoutCommentWithClub[]);
        }
      });
    };

    setComments((prev) => {
      const updated = [...prev];
      updateCommentLikes(updated);
      return updated;
    });

    // 백그라운드에서 API 호출
    try {
      await feedService.toggleCommentLike(commentId, user.id, isLiked);
    } catch (error) {
      console.error('댓글 좋아요 토글 실패:', error);
      // 실패 시 롤백
      setComments((prev) => {
        const rollback = [...prev];
        updateCommentLikes(rollback); // 다시 한 번 토글해서 원상복구
        return rollback;
      });
      alert('좋아요 처리에 실패했습니다.');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderComment = (comment: WorkoutCommentWithClub, isReply = false) => {
    const isHighlighted = highlightCommentId === comment.id;

    // 프로필 이미지 처리
    const renderAvatar = () => {
      const profileImage = comment.user?.profile_image;
      const displayName = comment.user?.display_name || '?';

      if (profileImage?.startsWith('default:')) {
        // default:color 형식 - 색상 아바타
        const color = profileImage.replace('default:', '');
        return (
          <div
            className="comment-avatar-placeholder"
            style={{ background: color, color: 'white' }}
          >
            {displayName[0].toUpperCase()}
          </div>
        );
      } else if (profileImage) {
        // URL 형식 - 이미지
        return (
          <img
            src={profileImage}
            alt={displayName}
            className="comment-avatar"
          />
        );
      } else {
        // 프로필 이미지 없음 - 기본 그라데이션
        return (
          <div
            className="comment-avatar-placeholder"
            style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}
          >
            {displayName[0]}
          </div>
        );
      }
    };

    return (
      <div
        key={comment.id}
        id={`comment-${comment.id}`}
        className={`comment-item ${isReply ? 'comment-reply' : ''} ${isHighlighted ? 'highlighted' : ''}`}
      >
        <div className="comment-header">
          {renderAvatar()}
          <div className="comment-info">
            <div className="comment-author">
              {comment.user?.display_name || '알 수 없음'}
              <span className="club-badge">{comment.club_name}</span>
            </div>
            <div className="comment-time">{formatTime(comment.created_at)}</div>
          </div>
        </div>

        <div className="comment-text">{comment.comment}</div>

        {/* 댓글 액션 (좋아요, 답글) */}
        {user && (
          <div className="comment-actions">
            <button
              className={`comment-action-btn ${comment.is_liked_by_me ? 'liked' : ''}`}
              onClick={() => handleCommentLike(comment.id, comment.is_liked_by_me || false)}
            >
              <Heart size={14} fill={comment.is_liked_by_me ? 'currentColor' : 'none'} />
              {comment.like_count ? `좋아요 ${comment.like_count}` : '좋아요'}
            </button>
            {!isReply && (
              <button
                className="comment-action-btn"
                onClick={() =>
                  setReplyTo({
                    id: comment.id,
                    clubId: comment.club_id,
                    name: comment.user?.display_name || '알 수 없음',
                  })
                }
              >
                <Reply size={14} />
                답글
              </button>
            )}
          </div>
        )}

        {/* 답글 입력 폼 */}
        {replyTo?.id === comment.id && (
          <form onSubmit={handleReplySubmit} className="reply-form">
            <input
              type="text"
              placeholder={`${replyTo.name}님에게 답글 작성...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="reply-input"
              autoFocus
            />
            <div className="reply-form-actions">
              <button type="button" onClick={() => setReplyTo(null)} className="btn-cancel">
                취소
              </button>
              <button type="submit" disabled={submitting || !replyText.trim()} className="btn-submit">
                {submitting ? '...' : '작성'}
              </button>
            </div>
          </form>
        )}

        {/* 대댓글 렌더링 */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="comment-replies">
            {comment.replies.map((reply) => renderComment(reply as WorkoutCommentWithClub, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="integrated-comment-section">
      {loading ? (
        <div className="comment-loading">댓글 불러오는 중...</div>
      ) : comments.length === 0 ? (
        <div className="comment-empty">아직 댓글이 없습니다.</div>
      ) : (
        <div className="comment-list">{comments.map((comment) => renderComment(comment))}</div>
      )}
    </div>
  );
};
