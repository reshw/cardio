-- 댓글/대댓글 좋아요 알림 기능 추가

-- notifications 테이블에 comment_like_id 컬럼 추가 (선택사항)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_like_id UUID REFERENCES comment_likes(id) ON DELETE CASCADE;

-- 댓글 좋아요 시 알림 생성 트리거 함수
CREATE OR REPLACE FUNCTION create_comment_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  comment_owner_id UUID;
  workout_id_var UUID;
  club_id_var UUID;
BEGIN
  -- 댓글 작성자 ID 및 workout_id, club_id 조회
  SELECT user_id, workout_id, club_id INTO comment_owner_id, workout_id_var, club_id_var
  FROM workout_comments
  WHERE id = NEW.comment_id;

  -- 본인이 좋아요한 경우 알림 생성 안함
  IF comment_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 알림 생성 (type은 'comment_like'로 새로 정의하거나, 'like'로 통일)
  -- 여기서는 'like'로 통일하되, comment_id를 포함시킴
  INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type, comment_id, comment_like_id)
  VALUES (comment_owner_id, NEW.user_id, workout_id_var, club_id_var, 'like', NEW.comment_id, NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 댓글 좋아요 테이블에 트리거 연결
DROP TRIGGER IF EXISTS trigger_comment_like_notification ON comment_likes;
CREATE TRIGGER trigger_comment_like_notification
  AFTER INSERT ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_like_notification();

-- 참고: 알림 메시지 예시
-- "홍길동님이 회원님의 댓글에 좋아요를 눌렀습니다."
-- 또는
-- "홍길동님이 2026년 3월 18일 달리기 - 러닝 댓글에 좋아요를 눌렀습니다."
