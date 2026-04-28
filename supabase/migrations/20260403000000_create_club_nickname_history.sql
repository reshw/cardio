-- 클럽 닉네임 변경 이력 테이블
CREATE TABLE IF NOT EXISTS club_nickname_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_nickname TEXT,           -- 이전 닉네임 (최초 설정이면 NULL)
  new_nickname TEXT NOT NULL,  -- 변경된 닉네임
  changed_by   UUID REFERENCES users(id) ON DELETE SET NULL,  -- 변경자 (본인 or 관리자)
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_club_nickname_history_club_user
  ON club_nickname_history(club_id, user_id);

CREATE INDEX idx_club_nickname_history_changed_at
  ON club_nickname_history(changed_at);

-- RLS 활성화
ALTER TABLE club_nickname_history ENABLE ROW LEVEL SECURITY;

-- 클럽 멤버는 같은 클럽의 이력 조회 가능
CREATE POLICY "club_members_can_view_nickname_history"
  ON club_nickname_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_nickname_history.club_id
        AND club_members.user_id = auth.uid()
    )
  );

-- 본인 이력은 본인이 삽입 (서비스 레이어에서 호출)
CREATE POLICY "members_can_insert_own_nickname_history"
  ON club_nickname_history FOR INSERT
  WITH CHECK (
    auth.uid() = changed_by
    OR EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_nickname_history.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('manager', 'vice-manager')
    )
  );
