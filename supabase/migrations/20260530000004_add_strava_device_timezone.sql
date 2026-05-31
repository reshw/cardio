ALTER TABLE "public"."workouts"
  ADD COLUMN IF NOT EXISTS "device_name" text,
  ADD COLUMN IF NOT EXISTS "timezone" text,
  ADD COLUMN IF NOT EXISTS "utc_offset" integer;
