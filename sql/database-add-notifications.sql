-- 알림 테이블 생성
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment')),
  comment_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- RLS (Row Level Security) 활성화
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 알림만 조회 가능
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 알림만 삭제 가능
CREATE POLICY "Users can delete their own notifications"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- 2주 지난 알림 자동 삭제 함수
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2주 지난 알림 자동 삭제 스케줄 (매일 자정 실행)
-- Note: Supabase에서는 pg_cron 확장을 사용하거나, 클라이언트에서 주기적으로 호출해야 함
-- 여기서는 함수만 생성하고, 실제 스케줄은 별도 설정 필요

-- 좋아요 시 알림 생성 트리거 함수
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  workout_owner_id UUID;
BEGIN
  -- 운동 작성자 ID 조회
  SELECT user_id INTO workout_owner_id
  FROM workouts
  WHERE id = NEW.workout_id;

  -- 본인이 좋아요한 경우 알림 생성 안함
  IF workout_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 알림 생성
  INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type)
  VALUES (workout_owner_id, NEW.user_id, NEW.workout_id, NEW.club_id, 'like');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 좋아요 테이블에 트리거 연결
DROP TRIGGER IF EXISTS trigger_like_notification ON workout_likes;
CREATE TRIGGER trigger_like_notification
  AFTER INSERT ON workout_likes
  FOR EACH ROW
  EXECUTE FUNCTION create_like_notification();

-- 댓글 시 알림 생성 트리거 함수
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

  -- 알림 생성
  INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type, comment_text)
  VALUES (workout_owner_id, NEW.user_id, NEW.workout_id, NEW.club_id, 'comment', NEW.comment);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 댓글 테이블에 트리거 연결
DROP TRIGGER IF EXISTS trigger_comment_notification ON workout_comments;
CREATE TRIGGER trigger_comment_notification
  AFTER INSERT ON workout_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();
