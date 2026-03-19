-- 클럽별 운동 마일리지 스냅샷 테이블
-- 각 클럽마다 다른 계수로 계산된 마일리지를 저장

CREATE TABLE IF NOT EXISTS club_workout_mileage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mileage DECIMAL NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mileage_config_snapshot JSONB,
  UNIQUE(club_id, workout_id)
);

-- 인덱스: 클럽별 월별 조회
CREATE INDEX IF NOT EXISTS idx_club_workout_mileage_club_month
ON club_workout_mileage(club_id, year, month);

-- 인덱스: 사용자별 조회
CREATE INDEX IF NOT EXISTS idx_club_workout_mileage_user
ON club_workout_mileage(club_id, user_id, year, month);

-- 인덱스: workout_id로 조회 (운동 삭제 시)
CREATE INDEX IF NOT EXISTS idx_club_workout_mileage_workout
ON club_workout_mileage(workout_id);

-- 컬럼 설명
COMMENT ON TABLE club_workout_mileage IS '클럽별 운동 마일리지 스냅샷 - 각 클럽의 계수로 계산된 마일리지 저장';
COMMENT ON COLUMN club_workout_mileage.mileage IS '해당 클럽의 계수로 계산된 마일리지';
COMMENT ON COLUMN club_workout_mileage.mileage_config_snapshot IS '계산 시 사용된 마일리지 계수 (감사용)';

-- workouts.mileage 컬럼 제거 (선택사항 - 기존 데이터 보존하려면 주석 처리)
-- ALTER TABLE workouts DROP COLUMN IF EXISTS mileage;
