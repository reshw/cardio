-- ============================================
-- 명예의 전당 (Hall of Fame) 기능 추가
-- ============================================
--
-- 별도 hall_of_fame 테이블 생성
-- 3회 연속 마일리지 1등 등 특별한 업적을 달성한 멤버를 기리기 위한 기능
--
-- 실행: Supabase SQL Editor에서 실행
-- ============================================

-- 1. 명예의 전당 테이블 생성
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inducted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  inducted_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 한 클럽에서 같은 유저는 한 번만 등재
  UNIQUE(club_id, user_id)
);

-- 2. 인덱스 생성 (효율적인 조회)
CREATE INDEX IF NOT EXISTS idx_hof_club_id ON hall_of_fame(club_id);
CREATE INDEX IF NOT EXISTS idx_hof_user_id ON hall_of_fame(user_id);
CREATE INDEX IF NOT EXISTS idx_hof_club_user ON hall_of_fame(club_id, user_id);

-- 3. 테이블 및 컬럼 설명
COMMENT ON TABLE hall_of_fame IS '클럽별 명예의 전당 멤버 기록';
COMMENT ON COLUMN hall_of_fame.club_id IS '클럽 ID';
COMMENT ON COLUMN hall_of_fame.user_id IS '명예의 전당 등재 멤버 user_id';
COMMENT ON COLUMN hall_of_fame.inducted_at IS '명예의 전당 등재 일시';
COMMENT ON COLUMN hall_of_fame.inducted_by IS '등재 처리한 관리자 user_id';
COMMENT ON COLUMN hall_of_fame.reason IS '등재 사유 (선택)';

-- 4. RLS (Row Level Security) 정책 설정
ALTER TABLE hall_of_fame ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능
CREATE POLICY "hall_of_fame_select_policy" ON hall_of_fame
  FOR SELECT USING (true);

-- 클럽 관리자만 추가/삭제 가능 (추후 정책 추가 필요)
CREATE POLICY "hall_of_fame_insert_policy" ON hall_of_fame
  FOR INSERT WITH CHECK (true);

CREATE POLICY "hall_of_fame_delete_policy" ON hall_of_fame
  FOR DELETE USING (true);
