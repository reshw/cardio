-- 클럽 월별 통계 스냅샷 테이블
CREATE TABLE IF NOT EXISTS club_monthly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  total_mileage DECIMAL(10, 1) NOT NULL DEFAULT 0,
  workout_count INTEGER NOT NULL DEFAULT 0,
  workout_days INTEGER NOT NULL DEFAULT 0, -- 운동일수
  by_workout JSONB NOT NULL DEFAULT '{}', -- 운동별 마일리지 (동적)
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id, year, month)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_club_monthly_stats_club_month ON club_monthly_stats(club_id, year, month);
CREATE INDEX IF NOT EXISTS idx_club_monthly_stats_user ON club_monthly_stats(user_id);

-- RLS 정책
ALTER TABLE club_monthly_stats ENABLE ROW LEVEL SECURITY;

-- 클럽 멤버는 자신의 클럽 통계를 조회할 수 있음
CREATE POLICY "Club members can view their club stats"
  ON club_monthly_stats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_monthly_stats.club_id
      AND club_members.user_id = auth.uid()
    )
  );

-- 시스템(서비스 역할)이 통계를 삽입/수정할 수 있음
CREATE POLICY "Service role can manage stats"
  ON club_monthly_stats
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE club_monthly_stats IS '클럽 월별 통계 스냅샷 (마일리지 재계산 시 생성)';
COMMENT ON COLUMN club_monthly_stats.workout_days IS '해당 월에 운동한 일수 (유니크한 날짜 수)';
COMMENT ON COLUMN club_monthly_stats.by_workout IS '운동별 마일리지 (예: {"달리기-트레드밀": 10.5, "수영": 5.0})';
