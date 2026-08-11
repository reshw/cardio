ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS elevation_gain numeric(8,2),
  ADD COLUMN IF NOT EXISTS steps integer,
  ADD COLUMN IF NOT EXISTS max_heartrate numeric(5,1);

COMMENT ON COLUMN workouts.calories IS '소모 칼로리 (kcal)';
COMMENT ON COLUMN workouts.elevation_gain IS '누적 고도 상승 (m) - 등산/하이킹';
COMMENT ON COLUMN workouts.steps IS '걸음수';
COMMENT ON COLUMN workouts.max_heartrate IS '최고 심박수';
