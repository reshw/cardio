-- 클럽 설정: 미산입 운동도 운동일수에 포함할지 여부
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS count_excluded_workouts_in_days BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN clubs.count_excluded_workouts_in_days IS '미산입 운동(마일리지 0인 운동)도 운동일수에 포함할지 여부';
