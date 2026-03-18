-- notifications 테이블에 comment_id 컬럼 추가
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES workout_comments(id) ON DELETE CASCADE;

-- 댓글 알림 트리거 함수 수정 (comment_id 저장)
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
BEGIN
  -- 운동 작성자 ID 조회
  SELECT user_id INTO workout_owner_id
  FROM workouts
  WHERE id = NEW.workout_id;

  -- 본인이 댓글 단 경우 알림 생성 안함
  IF workout_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 알림 생성 (comment_id 포함)
  INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type, comment_text, comment_id)
  VALUES (workout_owner_id, NEW.user_id, NEW.workout_id, NEW.club_id, 'comment', NEW.comment, NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
