-- Strava 연동 상세 지표 컬럼 추가
ALTER TABLE "public"."workouts"
  ADD COLUMN IF NOT EXISTS "elapsed_seconds" integer,
  ADD COLUMN IF NOT EXISTS "moving_seconds" integer,
  ADD COLUMN IF NOT EXISTS "average_speed" numeric(8,4),
  ADD COLUMN IF NOT EXISTS "average_heartrate" numeric(5,1);
