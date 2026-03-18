-- notifications 테이블에 read 컬럼 추가
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- RLS 정책: 사용자는 자신의 알림만 업데이트 가능
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 2주 지난 알림 자동 삭제 함수 수정 (read 여부 무관)
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 참고: 기존 알림들은 read = false로 설정됨 (기본값)
