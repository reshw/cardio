


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_adjusted_distance"("distance_km" numeric, "adjusted_dist_km" numeric, "workout_name" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  base_distance NUMERIC;
  category TEXT;
  multiplier NUMERIC;
BEGIN
  -- 인클라인 보정된 거리가 있으면 우선 사용, 없으면 원본 거리
  base_distance := COALESCE(adjusted_dist_km, distance_km, 0);

  IF base_distance = 0 THEN
    RETURN 0;
  END IF;

  category := get_cardio_category(workout_name);
  multiplier := get_cardio_multiplier(category);

  RETURN ROUND((base_distance * multiplier)::NUMERIC, 2);
END;
$$;


ALTER FUNCTION "public"."calculate_adjusted_distance"("distance_km" numeric, "adjusted_dist_km" numeric, "workout_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_mileage"("p_category" "text", "p_sub_type" "text", "p_value" numeric, "p_unit" "text") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
  DECLARE
    v_key TEXT;
    v_coefficient DECIMAL;
  BEGIN
    IF p_sub_type IS NOT NULL THEN
      v_key := p_category || '-' || p_sub_type;
    ELSE
      v_key := p_category;
    END IF;

    CASE v_key
      WHEN '달리기-트레드밀' THEN v_coefficient := 1;
      WHEN '달리기-러닝' THEN v_coefficient := 1;
      WHEN '사이클-실외' THEN v_coefficient := 0.333;
      WHEN '사이클-실내' THEN v_coefficient := 0.2;
      WHEN '수영' THEN v_coefficient := 0.005;
      WHEN '계단' THEN v_coefficient := 0.05;
      ELSE v_coefficient := 1;
    END CASE;

    RETURN p_value * v_coefficient;
  END;
  $$;


ALTER FUNCTION "public"."calculate_mileage"("p_category" "text", "p_sub_type" "text", "p_value" numeric, "p_unit" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_comment_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  workout_owner_id UUID;
BEGIN
  -- 운동 작성자 ID 조회
  SELECT user_id INTO workout_owner_id
  FROM workouts
  WHERE id = NEW.workout_id;

  -- 본인이 댓글 단 경우 알림 생성 안함
  IF workout_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 알림 생성 (comment_id 포함)
  INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type, comment_text, comment_id)
  VALUES (workout_owner_id, NEW.user_id, NEW.workout_id, NEW.club_id, 'comment', NEW.comment, NEW.id);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_comment_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_like_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  workout_owner_id UUID;
BEGIN
  -- 운동 작성자 ID 조회
  SELECT user_id INTO workout_owner_id
  FROM workouts
  WHERE id = NEW.workout_id;

  -- 본인이 좋아요한 경우 알림 생성 안함
  IF workout_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- 알림 생성
  INSERT INTO notifications (user_id, actor_id, workout_id, club_id, type)
  VALUES (workout_owner_id, NEW.user_id, NEW.workout_id, NEW.club_id, 'like');

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_like_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_old_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$;


ALTER FUNCTION "public"."delete_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cardio_category"("workout_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  workout_name := LOWER(workout_name);

  -- Running (100%)
  IF workout_name LIKE ANY(ARRAY['%러닝%', '%트레드밀%', '%달리기%', '%조깅%', '%마라톤%', '%런닝%', '%뛰기%', '%running%', '%treadmill%', '%jogging%']) THEN
    RETURN 'running';

  -- Stepmill (100%)
  ELSIF workout_name LIKE ANY(ARRAY['%천국의계단%', '%스텝밀%', '%마이마운틴%', '%등산%', '%스테퍼%', '%계단%', '%스텝머신%', '%stepmill%', '%stairmaster%', '%stepper%']) THEN
    RETURN 'stepmill';

  -- Rowing (60%)
  ELSIF workout_name LIKE ANY(ARRAY['%로잉%', '%조정%', '%노젓기%', '%rowing%', '%rower%']) THEN
    RETURN 'rowing';

  -- Cycle (40%)
  ELSIF workout_name LIKE ANY(ARRAY['%사이클%', '%자전거%', '%따릉이%', '%스피닝%', '%바이크%', '%cycle%', '%bike%', '%spinning%']) THEN
    RETURN 'cycle';

  -- Other (30%)
  ELSE
    RETURN 'other';
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_cardio_category"("workout_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cardio_multiplier"("category" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  CASE category
    WHEN 'running' THEN RETURN 1.0;
    WHEN 'stepmill' THEN RETURN 1.0;
    WHEN 'rowing' THEN RETURN 0.6;
    WHEN 'cycle' THEN RETURN 0.4;
    WHEN 'other' THEN RETURN 0.3;
    ELSE RETURN 1.0;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."get_cardio_multiplier"("category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_club_dashboard"("p_club_id" "uuid", "p_current_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_badges JSONB;
  v_squad JSONB;
  v_leaderboards JSONB;
BEGIN

  -- 1. 🏆 Hall of Fame (배지 계산)
  WITH member_logs AS (
    SELECT
      wl.user_id, wl.created_at, wl.date,
      w.type, w.category, w.name, w.volume_kg, w.distance_km, w.adjusted_dist_km, w.run_count
    FROM workout_logs wl
    JOIN workouts w ON w.workout_log_id = wl.id
    WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id)
      AND wl.is_private = false
      AND wl.created_at >= NOW() - INTERVAL '30 days'
  ),
  -- Streak(연속 출석) 계산을 위한 CTE
  daily_logs AS (
    SELECT DISTINCT user_id, date FROM member_logs
  ),
  streaks AS (
    SELECT user_id, COUNT(*) as days
    FROM (
        SELECT user_id, date,
               -- 날짜에서 행번호를 빼서 그룹핑 (연속된 날짜면 같은 그룹이 됨)
               date - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date) || ' days' AS INTERVAL) as grp
        FROM daily_logs
    ) t
    GROUP BY user_id, grp
    -- 어제나 오늘 기록이 있어야 '현재 진행중인' 스트릭으로 인정
    HAVING MAX(date) >= CURRENT_DATE - INTERVAL '1 day' 
  ),
  badge_winners AS (
    -- 🔥 워커홀릭 (월간 최다 출석)
    (SELECT user_id, 'effort' as type, '워커홀릭' as title, '🔥' as icon, 
            count(distinct date) as val, '일 출석' as unit
     FROM member_logs GROUP BY user_id ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- ⚡ 작심삼일 타파 (현재 연속 출석 1위) - NEW
    (SELECT user_id, 'effort' as type, '멈추지 않는 기관차' as title, '🚂' as icon, 
            days as val, '일 연속' as unit
     FROM streaks ORDER BY days DESC LIMIT 1)

    UNION ALL
    
    -- 🎨 육각형 멤버 (종목 다양성 1위) - NEW
    (SELECT user_id, 'effort' as type, '육각형 멤버' as title, '💎' as icon, 
            count(DISTINCT COALESCE(type, category)) as val, '개 종목' as unit
     FROM member_logs 
     GROUP BY user_id 
     HAVING count(DISTINCT COALESCE(type, category)) >= 2 -- 최소 2개 종목 이상
     ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- 🏋️ 3대 500 꿈나무 (볼륨 킹)
    (SELECT user_id, 'strength' as type, '3대 500 꿈나무' as title, '🦍' as icon, sum(volume_kg)::int as val, 'kg 볼륨' as unit
     FROM member_logs WHERE type = 'strength' GROUP BY user_id HAVING sum(volume_kg) > 0 ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- 🏃 강철 심장 (거리 킹) - 환산 거리 적용
    (SELECT user_id, 'cardio' as type, '지칠 줄 모르는 심장' as title, '🫀' as icon,
            round(sum(calculate_adjusted_distance(distance_km, adjusted_dist_km, name))::numeric, 1) as val, 'km 환산' as unit
     FROM member_logs WHERE type = 'cardio' GROUP BY user_id
     HAVING sum(calculate_adjusted_distance(distance_km, adjusted_dist_km, name)) > 0 ORDER BY val DESC LIMIT 1)
     
    UNION ALL
    
    -- 🏂 설원의 지배자 (스노보드 킹)
    (SELECT user_id, 'snowboard' as type, '설원의 지배자' as title, '❄️' as icon, sum(run_count)::int as val, '런' as unit
     FROM member_logs WHERE category = 'snowboard' GROUP BY user_id HAVING sum(run_count) > 0 ORDER BY val DESC LIMIT 1)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', u.id,
      'userName', u.display_name,
      'userProfile', u.profile_image,
      'type', bw.type,
      'title', bw.title,
      'icon', bw.icon,
      'description', bw.val || bw.unit,
      'isMe', (u.id = p_current_user_id)
    ) ORDER BY (u.id = p_current_user_id) DESC, random()
  ) INTO v_badges
  FROM badge_winners bw
  JOIN users u ON u.id = bw.user_id;


  -- 2. 👥 Active Squad (유지)
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', user_id,
      'displayName', display_name,
      'profileImage', profile_image,
      'mainActivity', workout_name,
      'workoutCount', workout_count,
      'activityType', activity_type,
      'lastActiveDate', last_active_date
    ) ORDER BY 
      CASE WHEN activity_type = 'today' THEN 1 ELSE 2 END,
      last_active_date DESC
  ) INTO v_squad
  FROM (
    SELECT DISTINCT ON (wl.user_id)
      wl.user_id,
      u.display_name,
      u.profile_image,
      w.name as workout_name,
      COUNT(*) OVER (PARTITION BY wl.user_id) as workout_count,
      CASE 
        WHEN wl.date = CURRENT_DATE THEN 'today'
        ELSE 'yesterday'
      END as activity_type,
      wl.created_at as last_active_date
    FROM workout_logs wl
    JOIN users u ON u.id = wl.user_id
    JOIN workouts w ON w.workout_log_id = wl.id
    WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id)
      AND wl.is_private = false
      AND wl.date >= CURRENT_DATE - 1
    ORDER BY wl.user_id, wl.created_at DESC
  ) squad_sub;


  -- 3. 📊 Leaderboards (유지 - 로직 동일하므로 생략 없이 포함)
  v_leaderboards := jsonb_build_object(
    'cardio', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', user_id, 'displayName', display_name, 'profileImage', profile_image, 'value', total_val) ORDER BY total_val DESC), '[]'::jsonb)
        FROM (
            SELECT wl.user_id, u.display_name, u.profile_image,
                   ROUND(SUM(calculate_adjusted_distance(w.distance_km, w.adjusted_dist_km, w.name))::numeric, 1) as total_val
            FROM workout_logs wl JOIN users u ON u.id = wl.user_id JOIN workouts w ON w.workout_log_id = wl.id
            WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id)
              AND wl.is_private = false
              AND wl.created_at >= NOW() - INTERVAL '30 days'
              AND w.type = 'cardio'
            GROUP BY wl.user_id, u.display_name, u.profile_image
            HAVING SUM(calculate_adjusted_distance(w.distance_km, w.adjusted_dist_km, w.name)) > 0
            LIMIT 10
        ) t
    ),
    'strength', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', user_id, 'displayName', display_name, 'profileImage', profile_image, 'value', total_val) ORDER BY total_val DESC), '[]'::jsonb)
        FROM (
            SELECT wl.user_id, u.display_name, u.profile_image, ROUND(SUM(COALESCE(w.volume_kg, w.sets * w.reps * w.weight_kg, 0))::numeric, 0) as total_val
            FROM workout_logs wl JOIN users u ON u.id = wl.user_id JOIN workouts w ON w.workout_log_id = wl.id
            WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id) AND wl.is_private = false AND wl.created_at >= NOW() - INTERVAL '30 days' AND (w.type = 'strength' OR w.category IN ('gym', 'home'))
            GROUP BY wl.user_id, u.display_name, u.profile_image HAVING SUM(COALESCE(w.volume_kg, 0)) > 0 LIMIT 10
        ) t
    ),
    'snowboard', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('userId', user_id, 'displayName', display_name, 'profileImage', profile_image, 'value', total_val) ORDER BY total_val DESC), '[]'::jsonb)
        FROM (
            SELECT wl.user_id, u.display_name, u.profile_image, SUM(COALESCE(w.run_count, 0)) as total_val
            FROM workout_logs wl JOIN users u ON u.id = wl.user_id JOIN workouts w ON w.workout_log_id = wl.id
            WHERE wl.user_id IN (SELECT user_id FROM club_members WHERE club_id = p_club_id) AND wl.is_private = false AND wl.created_at >= NOW() - INTERVAL '30 days' AND w.category = 'snowboard'
            GROUP BY wl.user_id, u.display_name, u.profile_image HAVING SUM(COALESCE(w.run_count, 0)) > 0 LIMIT 10
        ) t
    )
  );

  RETURN jsonb_build_object(
    'badges', COALESCE(v_badges, '[]'::jsonb),
    'squad', COALESCE(v_squad, '[]'::jsonb),
    'leaderboards', v_leaderboards
  );
END;
$$;


ALTER FUNCTION "public"."get_club_dashboard"("p_club_id" "uuid", "p_current_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_club_dashboard"("p_club_id" "uuid", "p_current_user_id" "uuid") IS '클럽 대시보드의 모든 집계 데이터를 반환 (배지, 스쿼드, 리더보드)';



CREATE OR REPLACE FUNCTION "public"."increment_challenge_value"("p_challenge_id" "uuid", "p_increment" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE club_challenges
  SET current_value = current_value + p_increment,
      updated_at = NOW()
  WHERE id = p_challenge_id;
END;
$$;


ALTER FUNCTION "public"."increment_challenge_value"("p_challenge_id" "uuid", "p_increment" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_workout_types_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_workout_types_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cardio_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_id" "uuid",
    "equipment" "text",
    "distance_km" numeric(6,2),
    "adjusted_distance_km" numeric(6,2),
    "pace_min_per_km" numeric(6,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cardio_details_equipment_check" CHECK (("equipment" = ANY (ARRAY['treadmill'::"text", 'cycle'::"text", 'rowing'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."cardio_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workout_log_id" "uuid" NOT NULL,
    "contribution_value" integer NOT NULL,
    "contributed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."challenge_participants" IS '챌린지 참가 기록 및 기여 내역';



CREATE OR REPLACE VIEW "public"."challenge_contributions" AS
 SELECT "id",
    "challenge_id",
    "user_id",
    "workout_log_id",
    "contribution_value",
    "contributed_at"
   FROM "public"."challenge_participants";


ALTER VIEW "public"."challenge_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "club_id" "uuid",
    "created_by" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "goal_metric" "text" NOT NULL,
    "goal_value" integer NOT NULL,
    "current_value" integer DEFAULT 0,
    "start_date" "text" NOT NULL,
    "end_date" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "meta_data" "jsonb" DEFAULT '{}'::"jsonb",
    "origin_challenge_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rules" "jsonb",
    "theme_color" "text" DEFAULT '#8b5cf6'::"text",
    CONSTRAINT "challenges_goal_metric_check" CHECK (("goal_metric" = ANY (ARRAY['total_workouts'::"text", 'total_volume'::"text", 'total_duration'::"text", 'total_distance'::"text", 'custom'::"text"]))),
    CONSTRAINT "challenges_scope_check" CHECK (("scope" = ANY (ARRAY['global'::"text", 'club'::"text"]))),
    CONSTRAINT "challenges_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "check_club_scope" CHECK (((("scope" = 'global'::"text") AND ("club_id" IS NULL)) OR (("scope" = 'club'::"text") AND ("club_id" IS NOT NULL))))
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


COMMENT ON TABLE "public"."challenges" IS 'Two-Track 챌린지 시스템: Global(앱 전체) + Club(클럽별)';



COMMENT ON COLUMN "public"."challenges"."scope" IS '범위: global(앱 전체) 또는 club(클럽 전용)';



COMMENT ON COLUMN "public"."challenges"."club_id" IS 'club 스코프일 때만 필수, global은 NULL';



COMMENT ON COLUMN "public"."challenges"."goal_metric" IS '측정 지표: total_workouts, total_volume, total_duration, total_distance';



COMMENT ON COLUMN "public"."challenges"."meta_data" IS '컨텍스트 데이터 (JSONB): season, tier, badge_url (global) / bet_mode, penalty, meme_image (club)';



COMMENT ON COLUMN "public"."challenges"."origin_challenge_id" IS '원본 챌린지 ID (포크된 경우)';



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


ALTER VIEW "public"."club_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_feeds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workout_log_id" "uuid" NOT NULL,
    "shared_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."club_feeds" OWNER TO "postgres";


COMMENT ON TABLE "public"."club_feeds" IS '[DEPRECATED] 더 이상 사용하지 않음. Zero-Copy View Architecture로 전환됨. workout_logs를 직접 조회하세요.';



COMMENT ON COLUMN "public"."club_feeds"."club_id" IS '클럽 ID';



COMMENT ON COLUMN "public"."club_feeds"."user_id" IS '공유한 사용자 ID';



COMMENT ON COLUMN "public"."club_feeds"."workout_log_id" IS '공유된 운동 기록 ID';



CREATE TABLE IF NOT EXISTS "public"."club_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "display_order" integer DEFAULT 0,
    "club_nickname" "text",
    "show_in_feed" boolean DEFAULT true,
    "show_mileage" boolean DEFAULT true,
    "club_profile_image" "text",
    CONSTRAINT "club_members_role_check" CHECK (("role" = ANY (ARRAY['manager'::"text", 'vice-manager'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."club_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."club_members"."show_in_feed" IS '피드에 내 운동 기록 표시 여부';



COMMENT ON COLUMN "public"."club_members"."show_mileage" IS '랭킹에 내 마일리지 포함 여부';



CREATE TABLE IF NOT EXISTS "public"."club_workout_mileage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "workout_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mileage" numeric NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "mileage_config_snapshot" "jsonb",
    "workout_date" "date"
);


ALTER TABLE "public"."club_workout_mileage" OWNER TO "postgres";


COMMENT ON TABLE "public"."club_workout_mileage" IS '클럽별 운동 마일리지 스냅샷 - 각 클럽의 계수로 계산된 마일리지 저장';



COMMENT ON COLUMN "public"."club_workout_mileage"."mileage" IS '해당 클럽의 계수로 계산된 마일리지';



COMMENT ON COLUMN "public"."club_workout_mileage"."mileage_config_snapshot" IS '계산 시 사용된 마일리지 계수 (감사용)';



COMMENT ON COLUMN "public"."club_workout_mileage"."workout_date" IS '운동 날짜 (운동일수 계산용)';



CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "mileage_config" "jsonb" DEFAULT '{"계단": 0.05, "수영": 0.005, "달리기-러닝": 1, "사이클-실내": 0.2, "사이클-실외": 0.333, "달리기-트레드밀": 1}'::"jsonb",
    "invite_code" "text",
    "logo_url" "text",
    "status" "text" DEFAULT 'active'::"text",
    "rejection_reason" "text",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "enabled_categories" "jsonb",
    "count_excluded_workouts_in_days" boolean DEFAULT true NOT NULL,
    CONSTRAINT "clubs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clubs"."enabled_categories" IS 'Array of enabled category keys for club rankings. Null means all categories enabled (backward compatibility).';



COMMENT ON COLUMN "public"."clubs"."count_excluded_workouts_in_days" IS '미산입 운동(마일리지 0인 운동)도 운동일수에 포함할지 여부';



CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_todos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "source" "text",
    "ai_recommendation" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "daily_todos_source_check" CHECK (("source" = ANY (ARRAY['ai_recommendation'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."daily_todos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hall_of_fame" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "inducted_at" timestamp with time zone DEFAULT "now"(),
    "inducted_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hall_of_fame" OWNER TO "postgres";


COMMENT ON TABLE "public"."hall_of_fame" IS '클럽별 명예의 전당 멤버 기록';



COMMENT ON COLUMN "public"."hall_of_fame"."club_id" IS '클럽 ID';



COMMENT ON COLUMN "public"."hall_of_fame"."user_id" IS '명예의 전당 등재 멤버 user_id';



COMMENT ON COLUMN "public"."hall_of_fame"."inducted_at" IS '명예의 전당 등재 일시';



COMMENT ON COLUMN "public"."hall_of_fame"."inducted_by" IS '등재 처리한 관리자 user_id';



COMMENT ON COLUMN "public"."hall_of_fame"."reason" IS '등재 사유 (선택)';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "workout_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "comment_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read" boolean DEFAULT false,
    "comment_id" "uuid",
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['like'::"text", 'comment'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_user_id" "uuid" NOT NULL,
    "workout_id" "uuid",
    "club_id" "uuid",
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_settings" IS '시스템 전역 설정';



COMMENT ON COLUMN "public"."system_settings"."key" IS '설정 키 (예: image_upload, notification_config)';



COMMENT ON COLUMN "public"."system_settings"."value" IS '설정 값 (JSONB 형식)';



COMMENT ON COLUMN "public"."system_settings"."updated_by" IS '마지막 수정한 슈퍼관리자 ID';



CREATE TABLE IF NOT EXISTS "public"."todo_workouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "daily_todo_id" "uuid",
    "name" "text" NOT NULL,
    "sets" integer,
    "reps" integer,
    "weight_kg" numeric(6,2),
    "duration_min" integer,
    "note" "text",
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."todo_workouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "goals" "text",
    "raw_input" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "email" "text",
    "kakao_id" "text",
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "provider" "text" DEFAULT 'local'::"text",
    "profile_image" "text",
    "phone_number" "text",
    "birthyear" "text",
    "gender" "text",
    "nickname" "text",
    "is_admin" boolean DEFAULT false,
    "is_tester" boolean DEFAULT false,
    "is_sub_admin" boolean DEFAULT false,
    "is_super_admin" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."kakao_id" IS '카카오 사용자 고유 ID';



COMMENT ON COLUMN "public"."users"."provider" IS '로그인 제공자 (local, kakao)';



COMMENT ON COLUMN "public"."users"."profile_image" IS '프로필 이미지 URL';



COMMENT ON COLUMN "public"."users"."phone_number" IS '전화번호';



COMMENT ON COLUMN "public"."users"."birthyear" IS '출생년도';



COMMENT ON COLUMN "public"."users"."gender" IS '성별 (male, female)';



COMMENT ON COLUMN "public"."users"."nickname" IS '카카오 닉네임';



CREATE TABLE IF NOT EXISTS "public"."workout_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workout_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workout_id" "uuid" NOT NULL,
    "club_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workout_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "date" "date" NOT NULL,
    "raw_text" "text" NOT NULL,
    "normalized_text" "text",
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_private" boolean DEFAULT false
);


ALTER TABLE "public"."workout_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."workout_logs"."is_private" IS '비공개 여부 (true: 나만 보기, false: 클럽 멤버와 공유)';



CREATE TABLE IF NOT EXISTS "public"."workout_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "sub_types" "jsonb" DEFAULT '[]'::"jsonb",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sub_type_mode" "text" DEFAULT 'single'::"text" NOT NULL,
    "is_core" boolean DEFAULT false NOT NULL,
    CONSTRAINT "workout_types_sub_type_mode_check" CHECK (("sub_type_mode" = ANY (ARRAY['single'::"text", 'mixed'::"text"]))),
    CONSTRAINT "workout_types_unit_check" CHECK (("unit" = ANY (ARRAY['km'::"text", 'm'::"text", '층'::"text", '분'::"text", '회'::"text", '세트'::"text"])))
);


ALTER TABLE "public"."workout_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "sub_type" "text",
    "value" numeric(10,2) NOT NULL,
    "unit" "text" NOT NULL,
    "proof_image" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "intensity" integer DEFAULT 4,
    "sub_type_ratios" "jsonb",
    "workout_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workouts_intensity_check" CHECK ((("intensity" >= 1) AND ("intensity" <= 10)))
);


ALTER TABLE "public"."workouts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."workouts"."created_at" IS '기록을 시스템에 올린 시점 (스냅샷, 순서 결정용, 수정 불가)';



COMMENT ON COLUMN "public"."workouts"."intensity" IS '운동 강도 (1-10 단계, 기본값 4)';



COMMENT ON COLUMN "public"."workouts"."sub_type_ratios" IS 'JSON object containing sub-type ratios. Example: {"일반": 0.4, "빈야사/아쉬탕가": 0.6}. Null means single sub-type workout.';



COMMENT ON COLUMN "public"."workouts"."workout_time" IS '실제 운동을 수행한 시간 (사용자 수정 가능)';



ALTER TABLE ONLY "public"."cardio_details"
    ADD CONSTRAINT "cardio_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_challenge_id_workout_log_id_key" UNIQUE ("challenge_id", "workout_log_id");



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_feeds"
    ADD CONSTRAINT "club_feeds_club_id_workout_log_id_key" UNIQUE ("club_id", "workout_log_id");



ALTER TABLE ONLY "public"."club_feeds"
    ADD CONSTRAINT "club_feeds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_user_id_key" UNIQUE ("club_id", "user_id");



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_workout_mileage"
    ADD CONSTRAINT "club_workout_mileage_club_id_workout_id_key" UNIQUE ("club_id", "workout_id");



ALTER TABLE ONLY "public"."club_workout_mileage"
    ADD CONSTRAINT "club_workout_mileage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_todos"
    ADD CONSTRAINT "daily_todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_club_id_user_id_key" UNIQUE ("club_id", "user_id");



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."todo_workouts"
    ADD CONSTRAINT "todo_workouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_blocked_id_club_id_key" UNIQUE ("blocker_id", "blocked_id", "club_id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_kakao_id_key" UNIQUE ("kakao_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."workout_comments"
    ADD CONSTRAINT "workout_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_likes"
    ADD CONSTRAINT "workout_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_likes"
    ADD CONSTRAINT "workout_likes_workout_id_club_id_user_id_key" UNIQUE ("workout_id", "club_id", "user_id");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workout_types"
    ADD CONSTRAINT "workout_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."workout_types"
    ADD CONSTRAINT "workout_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workouts"
    ADD CONSTRAINT "workouts_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_cardio_workout_id" ON "public"."cardio_details" USING "btree" ("workout_id");



CREATE INDEX "idx_challenge_participants_challenge_id" ON "public"."challenge_participants" USING "btree" ("challenge_id");



CREATE INDEX "idx_challenge_participants_user_id" ON "public"."challenge_participants" USING "btree" ("user_id");



CREATE INDEX "idx_challenge_participants_workout_log_id" ON "public"."challenge_participants" USING "btree" ("workout_log_id");



CREATE INDEX "idx_challenges_club" ON "public"."challenges" USING "btree" ("club_id", "start_date", "end_date", "status") WHERE ("scope" = 'club'::"text");



CREATE INDEX "idx_challenges_global" ON "public"."challenges" USING "btree" ("start_date", "end_date", "status") WHERE ("scope" = 'global'::"text");



CREATE INDEX "idx_challenges_scope" ON "public"."challenges" USING "btree" ("scope");



CREATE INDEX "idx_challenges_status" ON "public"."challenges" USING "btree" ("status");



CREATE INDEX "idx_club_feeds_club_id" ON "public"."club_feeds" USING "btree" ("club_id");



CREATE INDEX "idx_club_feeds_shared_at" ON "public"."club_feeds" USING "btree" ("shared_at" DESC);



CREATE INDEX "idx_club_feeds_user_id" ON "public"."club_feeds" USING "btree" ("user_id");



CREATE INDEX "idx_club_feeds_workout_log_id" ON "public"."club_feeds" USING "btree" ("workout_log_id");



CREATE INDEX "idx_club_members_club_id" ON "public"."club_members" USING "btree" ("club_id");



CREATE INDEX "idx_club_members_user_id" ON "public"."club_members" USING "btree" ("user_id");



CREATE INDEX "idx_club_members_user_order" ON "public"."club_members" USING "btree" ("user_id", "display_order");



CREATE INDEX "idx_club_workout_mileage_club_month" ON "public"."club_workout_mileage" USING "btree" ("club_id", "year", "month");



CREATE INDEX "idx_club_workout_mileage_date" ON "public"."club_workout_mileage" USING "btree" ("club_id", "year", "month", "workout_date");



CREATE INDEX "idx_club_workout_mileage_user" ON "public"."club_workout_mileage" USING "btree" ("club_id", "user_id", "year", "month");



CREATE INDEX "idx_club_workout_mileage_workout" ON "public"."club_workout_mileage" USING "btree" ("workout_id");



CREATE INDEX "idx_clubs_created_by" ON "public"."clubs" USING "btree" ("created_by");



CREATE INDEX "idx_clubs_invite_code" ON "public"."clubs" USING "btree" ("invite_code");



CREATE INDEX "idx_clubs_status" ON "public"."clubs" USING "btree" ("status");



CREATE INDEX "idx_comment_likes_comment_id" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_likes_user_id" ON "public"."comment_likes" USING "btree" ("user_id");



CREATE INDEX "idx_daily_todos_user_date" ON "public"."daily_todos" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_hof_club_id" ON "public"."hall_of_fame" USING "btree" ("club_id");



CREATE INDEX "idx_hof_club_user" ON "public"."hall_of_fame" USING "btree" ("club_id", "user_id");



CREATE INDEX "idx_hof_user_id" ON "public"."hall_of_fame" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_system_settings_updated_at" ON "public"."system_settings" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_users_is_admin" ON "public"."users" USING "btree" ("is_admin") WHERE ("is_admin" = true);



CREATE INDEX "idx_users_is_super_admin" ON "public"."users" USING "btree" ("is_super_admin");



CREATE INDEX "idx_users_kakao_id" ON "public"."users" USING "btree" ("kakao_id");



CREATE INDEX "idx_users_provider" ON "public"."users" USING "btree" ("provider");



CREATE INDEX "idx_workout_comments_created" ON "public"."workout_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_workout_comments_parent" ON "public"."workout_comments" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "idx_workout_comments_workout_club" ON "public"."workout_comments" USING "btree" ("workout_id", "club_id");



CREATE INDEX "idx_workout_comments_workout_id" ON "public"."workout_comments" USING "btree" ("workout_id");



CREATE INDEX "idx_workout_likes_user" ON "public"."workout_likes" USING "btree" ("user_id");



CREATE INDEX "idx_workout_likes_workout_club" ON "public"."workout_likes" USING "btree" ("workout_id", "club_id");



CREATE INDEX "idx_workout_likes_workout_id" ON "public"."workout_likes" USING "btree" ("workout_id");



CREATE INDEX "idx_workout_logs_is_private" ON "public"."workout_logs" USING "btree" ("is_private");



CREATE INDEX "idx_workout_logs_user_date" ON "public"."workout_logs" USING "btree" ("user_id", "date" DESC);



CREATE INDEX "idx_workout_types_display_order" ON "public"."workout_types" USING "btree" ("display_order");



CREATE INDEX "idx_workout_types_is_active" ON "public"."workout_types" USING "btree" ("is_active");



CREATE INDEX "idx_workout_types_is_core" ON "public"."workout_types" USING "btree" ("is_core");



CREATE INDEX "idx_workouts_category" ON "public"."workouts" USING "btree" ("category");



CREATE INDEX "idx_workouts_created_at" ON "public"."workouts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_workouts_user_id" ON "public"."workouts" USING "btree" ("user_id");



CREATE INDEX "idx_workouts_workout_time" ON "public"."workouts" USING "btree" ("workout_time" DESC);



CREATE OR REPLACE TRIGGER "trigger_comment_notification" AFTER INSERT ON "public"."workout_comments" FOR EACH ROW EXECUTE FUNCTION "public"."create_comment_notification"();



CREATE OR REPLACE TRIGGER "trigger_like_notification" AFTER INSERT ON "public"."workout_likes" FOR EACH ROW EXECUTE FUNCTION "public"."create_like_notification"();



CREATE OR REPLACE TRIGGER "trigger_update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "update_challenges_updated_at" BEFORE UPDATE ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "workout_types_updated_at" BEFORE UPDATE ON "public"."workout_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_workout_types_updated_at"();



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_origin_challenge_id_fkey" FOREIGN KEY ("origin_challenge_id") REFERENCES "public"."challenges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_feeds"
    ADD CONSTRAINT "club_feeds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_feeds"
    ADD CONSTRAINT "club_feeds_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_members"
    ADD CONSTRAINT "club_members_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_workout_mileage"
    ADD CONSTRAINT "club_workout_mileage_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_workout_mileage"
    ADD CONSTRAINT "club_workout_mileage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_workout_mileage"
    ADD CONSTRAINT "club_workout_mileage_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."workout_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_todos"
    ADD CONSTRAINT "daily_todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_inducted_by_fkey" FOREIGN KEY ("inducted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."hall_of_fame"
    ADD CONSTRAINT "hall_of_fame_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."workout_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."todo_workouts"
    ADD CONSTRAINT "todo_workouts_daily_todo_id_fkey" FOREIGN KEY ("daily_todo_id") REFERENCES "public"."daily_todos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_comments"
    ADD CONSTRAINT "workout_comments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_comments"
    ADD CONSTRAINT "workout_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."workout_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_comments"
    ADD CONSTRAINT "workout_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_comments"
    ADD CONSTRAINT "workout_comments_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_likes"
    ADD CONSTRAINT "workout_likes_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_likes"
    ADD CONSTRAINT "workout_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_likes"
    ADD CONSTRAINT "workout_likes_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can update club status" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Admins can view all clubs" ON "public"."clubs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Allow authenticated users to read users" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public insert" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Allow public update" ON "public"."users" FOR UPDATE USING (true);



CREATE POLICY "Anyone can view comment likes" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Enable all for cardio_details" ON "public"."cardio_details" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for daily_todos" ON "public"."daily_todos" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for todo_workouts" ON "public"."todo_workouts" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for user_profiles" ON "public"."user_profiles" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for users" ON "public"."users" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for workout_logs" ON "public"."workout_logs" USING (true) WITH CHECK (true);



CREATE POLICY "Only superadmins can delete system settings" ON "public"."system_settings" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_super_admin" = true)))));



CREATE POLICY "Only superadmins can modify system settings" ON "public"."system_settings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_super_admin" = true)))));



CREATE POLICY "Only superadmins can update system settings" ON "public"."system_settings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_super_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_super_admin" = true)))));



CREATE POLICY "Users can add their own comment likes" ON "public"."comment_likes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can delete their own comment likes" ON "public"."comment_likes" FOR DELETE USING (true);



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profile" ON "public"."user_profiles" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (true);



CREATE POLICY "Users can view their own profile" ON "public"."user_profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own workout logs" ON "public"."workout_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."cardio_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_todos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hall_of_fame" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hall_of_fame_delete_policy" ON "public"."hall_of_fame" FOR DELETE USING (true);



CREATE POLICY "hall_of_fame_insert_policy" ON "public"."hall_of_fame" FOR INSERT WITH CHECK (true);



CREATE POLICY "hall_of_fame_select_policy" ON "public"."hall_of_fame" FOR SELECT USING (true);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_workouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workout_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "신고 삽입만 가능" ON "public"."reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."calculate_adjusted_distance"("distance_km" numeric, "adjusted_dist_km" numeric, "workout_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_adjusted_distance"("distance_km" numeric, "adjusted_dist_km" numeric, "workout_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_adjusted_distance"("distance_km" numeric, "adjusted_dist_km" numeric, "workout_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_mileage"("p_category" "text", "p_sub_type" "text", "p_value" numeric, "p_unit" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_mileage"("p_category" "text", "p_sub_type" "text", "p_value" numeric, "p_unit" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_mileage"("p_category" "text", "p_sub_type" "text", "p_value" numeric, "p_unit" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_comment_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_comment_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_comment_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_like_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_like_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_like_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_old_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cardio_category"("workout_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cardio_category"("workout_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cardio_category"("workout_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cardio_multiplier"("category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cardio_multiplier"("category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cardio_multiplier"("category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_club_dashboard"("p_club_id" "uuid", "p_current_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_club_dashboard"("p_club_id" "uuid", "p_current_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_club_dashboard"("p_club_id" "uuid", "p_current_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_challenge_value"("p_challenge_id" "uuid", "p_increment" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_challenge_value"("p_challenge_id" "uuid", "p_increment" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_challenge_value"("p_challenge_id" "uuid", "p_increment" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_workout_types_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_workout_types_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_workout_types_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."cardio_details" TO "anon";
GRANT ALL ON TABLE "public"."cardio_details" TO "authenticated";
GRANT ALL ON TABLE "public"."cardio_details" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_participants" TO "anon";
GRANT ALL ON TABLE "public"."challenge_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_participants" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_contributions" TO "anon";
GRANT ALL ON TABLE "public"."challenge_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON TABLE "public"."club_challenges" TO "anon";
GRANT ALL ON TABLE "public"."club_challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."club_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."club_feeds" TO "anon";
GRANT ALL ON TABLE "public"."club_feeds" TO "authenticated";
GRANT ALL ON TABLE "public"."club_feeds" TO "service_role";



GRANT ALL ON TABLE "public"."club_members" TO "anon";
GRANT ALL ON TABLE "public"."club_members" TO "authenticated";
GRANT ALL ON TABLE "public"."club_members" TO "service_role";



GRANT ALL ON TABLE "public"."club_workout_mileage" TO "anon";
GRANT ALL ON TABLE "public"."club_workout_mileage" TO "authenticated";
GRANT ALL ON TABLE "public"."club_workout_mileage" TO "service_role";



GRANT ALL ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."daily_todos" TO "anon";
GRANT ALL ON TABLE "public"."daily_todos" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_todos" TO "service_role";



GRANT ALL ON TABLE "public"."hall_of_fame" TO "anon";
GRANT ALL ON TABLE "public"."hall_of_fame" TO "authenticated";
GRANT ALL ON TABLE "public"."hall_of_fame" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."todo_workouts" TO "anon";
GRANT ALL ON TABLE "public"."todo_workouts" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_workouts" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."workout_comments" TO "anon";
GRANT ALL ON TABLE "public"."workout_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_comments" TO "service_role";



GRANT ALL ON TABLE "public"."workout_likes" TO "anon";
GRANT ALL ON TABLE "public"."workout_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_likes" TO "service_role";



GRANT ALL ON TABLE "public"."workout_logs" TO "anon";
GRANT ALL ON TABLE "public"."workout_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_logs" TO "service_role";



GRANT ALL ON TABLE "public"."workout_types" TO "anon";
GRANT ALL ON TABLE "public"."workout_types" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_types" TO "service_role";



GRANT ALL ON TABLE "public"."workouts" TO "anon";
GRANT ALL ON TABLE "public"."workouts" TO "authenticated";
GRANT ALL ON TABLE "public"."workouts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


