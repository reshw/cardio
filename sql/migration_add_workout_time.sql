-- Migration: Add workout_time column to separate actual workout time from record creation time
-- Created: 2026-03-23
-- Purpose:
--   - created_at: 기록을 올린 시점 (스냅샷, 순서 결정용, 수정 불가)
--   - workout_time: 실제 운동한 시간 (사용자가 수정 가능)

-- Step 1: Add workout_time column (nullable first)
ALTER TABLE workouts
ADD COLUMN workout_time TIMESTAMP WITH TIME ZONE;

-- Step 2: Copy existing created_at values to workout_time
UPDATE workouts
SET workout_time = created_at
WHERE workout_time IS NULL;

-- Step 3: Make workout_time NOT NULL and set default
ALTER TABLE workouts
ALTER COLUMN workout_time SET NOT NULL,
ALTER COLUMN workout_time SET DEFAULT NOW();

-- Step 4: Add index for workout_time (for sorting by actual workout time)
CREATE INDEX idx_workouts_workout_time ON workouts(workout_time DESC);

-- Step 5: Add intensity column if not exists (from previous schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'workouts' AND column_name = 'intensity') THEN
    ALTER TABLE workouts ADD COLUMN intensity INTEGER DEFAULT 5;
  END IF;
END $$;

-- Step 6: Add sub_type_ratios column if not exists (from previous schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'workouts' AND column_name = 'sub_type_ratios') THEN
    ALTER TABLE workouts ADD COLUMN sub_type_ratios JSONB;
  END IF;
END $$;

-- Verify migration
SELECT
  COUNT(*) as total_workouts,
  COUNT(workout_time) as workouts_with_time,
  COUNT(*) - COUNT(workout_time) as missing_workout_time
FROM workouts;

COMMENT ON COLUMN workouts.created_at IS '기록을 시스템에 올린 시점 (스냅샷, 순서 결정용, 수정 불가)';
COMMENT ON COLUMN workouts.workout_time IS '실제 운동을 수행한 시간 (사용자 수정 가능)';
