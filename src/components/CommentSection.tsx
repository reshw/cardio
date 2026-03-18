import { useState, useEffect } from 'react';
import { Trash2, Reply } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import feedService from '../services/feedService';
import type { WorkoutComment } from '../services/feedService';

interface Props {
  workoutId: string;
  clubId: string;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}

export const CommentSection = ({ workoutId, clubId, onCommentAdded, onCommentDeleted }: Props) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<WorkoutComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [workoutId, clubId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await feedService.getComments(workoutId, clubId);
      setComments(data);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      await feedService.addComment(workoutId, clubId, user.id, newComment, replyTo || undefined);
      setNewComment('');
      setReplyTo(null);
      await loadComments();
      onCommentAdded?.();
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user || !confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      await feedService.deleteComment(commentId, user.id);
      await loadComments();
      onCommentDeleted?.(); // 댓글 수 감소
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  const renderAvatar = (profileImage: string | undefined, displayName: string) => {
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
      return <img src={profileImage} alt={displayName} className="comment-avatar" />;
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

  const renderComment = (comment: WorkoutComment, isReply = false) => (
    <div key={comment.id} className={`comment-item ${isReply ? 'comment-reply' : ''}`}>
      <div className="comment-header">
        {renderAvatar(comment.user?.profile_image, comment.user?.display_name || '?')}
        <div className="comment-info">
          <div className="comment-author">{comment.user?.display_name || '알 수 없음'}</div>
          <div className="comment-time">
            {new Date(comment.created_at).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>

      <div className="comment-text">{comment.comment}</div>

      <div className="comment-actions">
        {!isReply && (
          <button className="comment-action-btn" onClick={() => setReplyTo(comment.id)}>
            <Reply size={14} />
            답글
          </button>
        )}
        {user?.id === comment.user_id && (
          <button className="comment-action-btn delete" onClick={() => handleDelete(comment.id)}>
            <Trash2 size={14} />
            삭제
          </button>
        )}
      </div>

      {/* 대댓글 렌더링 */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  return (
    <div className="comment-section">
      {loading ? (
        <div className="comment-loading">댓글 불러오는 중...</div>
      ) : comments.length === 0 ? (
        <div className="comment-empty">첫 댓글을 남겨보세요!</div>
      ) : (
        <div className="comment-list">{comments.map((comment) => renderComment(comment))}</div>
      )}

      {/* 댓글 입력 폼 */}
      <form onSubmit={handleSubmit} className="comment-form">
        {replyTo && (
          <div className="reply-indicator">
            답글 작성 중
            <button type="button" onClick={() => setReplyTo(null)}>
              ✕
            </button>
          </div>
        )}
        <input
          type="text"
          placeholder={replyTo ? '답글을 입력하세요' : '댓글을 입력하세요'}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="comment-input"
          maxLength={500}
        />
        <button type="submit" className="comment-submit" disabled={submitting || !newComment.trim()}>
          {submitting ? '...' : '작성'}
        </button>
      </form>
    </div>
  );
};
