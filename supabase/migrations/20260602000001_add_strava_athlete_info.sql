ALTER TABLE "public"."user_integrations"
  ADD COLUMN IF NOT EXISTS "athlete_name" text,
  ADD COLUMN IF NOT EXISTS "athlete_profile" text;
