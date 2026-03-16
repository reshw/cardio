-- 클럽 월별 마일리지 설정 스냅샷 테이블 생성

CREATE TABLE IF NOT EXISTS club_monthly_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  mileage_config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 클럽당 월별로 하나의 스냅샷만
  UNIQUE(club_id, year, month)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_club_monthly_configs_club_date
ON club_monthly_configs(club_id, year, month);

-- 확인
SELECT * FROM club_monthly_configs LIMIT 5;
