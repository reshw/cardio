-- 스키마 드리프트 동기화: app_releases 테이블, club_challenges 뷰
-- 두 객체 모두 prod 에는 존재하지만 로컬 마이그레이션 이력에 없었음 (prod 대시보드에서 직접 생성된 것으로 추정 —
-- app_releases 는 docs/communicate/and.to.SERVER_TASK3.md 에 안드로이드 측 작업으로 기록됨).
-- fresh `supabase db reset` 후 prod 데이터 덤프를 로드할 때 app_releases INSERT 가
-- "relation does not exist" 로 실패해 발견됨.

CREATE TABLE IF NOT EXISTS "public"."app_releases" (
    "id" integer NOT NULL,
    "platform" "text" NOT NULL,
    "version" "text" NOT NULL,
    "url" "text" NOT NULL,
    "released_at" timestamp with time zone DEFAULT "now"()
);

CREATE SEQUENCE IF NOT EXISTS "public"."app_releases_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."app_releases_id_seq" OWNED BY "public"."app_releases"."id";

ALTER TABLE ONLY "public"."app_releases"
  ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."app_releases_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."app_releases"
  ADD CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."app_releases" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON "public"."app_releases" FOR SELECT USING (true);
CREATE POLICY "allow insert" ON "public"."app_releases" FOR INSERT WITH CHECK (true);
CREATE POLICY "allow update" ON "public"."app_releases" FOR UPDATE USING (true);

GRANT ALL ON TABLE "public"."app_releases" TO "anon";
GRANT ALL ON TABLE "public"."app_releases" TO "authenticated";
GRANT ALL ON TABLE "public"."app_releases" TO "service_role";
GRANT ALL ON SEQUENCE "public"."app_releases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_releases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_releases_id_seq" TO "service_role";

-- challenges 를 클럽 범위로 필터링한 뷰 (challenges 테이블은 기존 마이그레이션에서 이미 생성됨)
CREATE OR REPLACE VIEW "public"."club_challenges" AS
 SELECT "id",
    "club_id",
    "title",
    "description",
    "goal_metric" AS "challenge_type",
    "goal_value" AS "target_value",
    "current_value",
    "start_date",
    "end_date",
    "status",
    "created_by",
    "created_at",
    "updated_at",
    "rules",
    "theme_color"
   FROM "public"."challenges"
  WHERE ("scope" = 'club'::"text");

GRANT ALL ON TABLE "public"."club_challenges" TO "anon";
GRANT ALL ON TABLE "public"."club_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."club_challenges" TO "service_role";
