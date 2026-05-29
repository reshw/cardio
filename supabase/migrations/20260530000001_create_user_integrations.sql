-- user_integrations: 외부 서비스(Strava, Garmin) OAuth 토큰 저장
CREATE TABLE IF NOT EXISTS "public"."user_integrations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
    "provider" text NOT NULL,
    "provider_user_id" text NOT NULL,
    "access_token" text NOT NULL,
    "refresh_token" text,
    "token_expires_at" timestamp with time zone,
    "scope" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_integrations_user_provider_unique" UNIQUE ("user_id", "provider")
);

ALTER TABLE "public"."user_integrations" OWNER TO "postgres";

-- workouts에 외부 연동 출처 추적 컬럼 추가
ALTER TABLE "public"."workouts"
  ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "source_activity_id" text;

-- 동일 외부 활동 중복 삽입 방지
CREATE UNIQUE INDEX IF NOT EXISTS "workouts_source_activity_unique"
  ON "public"."workouts" ("user_id", "source", "source_activity_id")
  WHERE "source_activity_id" IS NOT NULL;

-- RLS
ALTER TABLE "public"."user_integrations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own integrations"
  ON "public"."user_integrations"
  FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can delete own integrations"
  ON "public"."user_integrations"
  FOR DELETE
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );
