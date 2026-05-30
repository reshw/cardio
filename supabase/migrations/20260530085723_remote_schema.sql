alter table "public"."clubs" add column "rookie_league_enabled" boolean not null default true;

alter table "public"."workouts" add column "device_info" jsonb;

alter table "public"."race_records" add constraint "race_records_category_check" CHECK ((category = ANY (ARRAY['5K'::text, '10K'::text, '하프'::text, '풀'::text, '기타'::text]))) not valid;

alter table "public"."race_records" validate constraint "race_records_category_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_club_mileage_summary(p_club_id uuid, p_year integer, p_month integer)
 RETURNS TABLE(user_id uuid, total_mileage numeric, workout_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    user_id,
    SUM(mileage)                              AS total_mileage,
    COUNT(*) FILTER (WHERE mileage > 0)       AS workout_count
  FROM club_workout_mileage
  WHERE club_id = p_club_id
    AND year    = p_year
    AND month   = p_month
  GROUP BY user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.is_club_manager(club_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE public.club_members.club_id = club_uuid
      AND public.club_members.user_id = auth.uid()
      AND public.club_members.role IN ('manager', 'vice-manager')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_club_mileage(p_club_id uuid, p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
BEGIN
  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Seoul');
  v_end   := v_start + interval '1 month';

  DELETE FROM club_workout_mileage
  WHERE club_id = p_club_id AND year = p_year AND month = p_month;

  -- 일반 운동 (sub_type_ratios 없음)
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    CASE
      WHEN cmc.enabled = true AND cmc.coefficient > 0
        THEN ROUND((w.value / cmc.coefficient)::numeric, 4)
      ELSE 0
    END,
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  LEFT JOIN club_mileage_configs cmc
    ON  cmc.club_id  = cm.club_id
    AND cmc.category = w.category
    AND (cmc.sub_type = w.sub_type OR (cmc.sub_type IS NULL AND w.sub_type IS NULL))
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND (w.sub_type_ratios IS NULL OR w.sub_type_ratios = '{}'::jsonb)
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage, calculated_at = EXCLUDED.calculated_at;

  -- 혼합 운동 (sub_type_ratios)
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    ROUND(SUM(
      CASE WHEN cmc.enabled = true AND cmc.coefficient > 0
        THEN w.value * (kv.value::text::numeric) / cmc.coefficient
        ELSE 0
      END
    )::numeric, 4),
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  CROSS JOIN LATERAL jsonb_each(w.sub_type_ratios) AS kv(key, value)
  LEFT JOIN club_mileage_configs cmc
    ON  cmc.club_id  = cm.club_id
    AND cmc.category = w.category
    AND cmc.sub_type = kv.key
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND w.sub_type_ratios IS NOT NULL AND w.sub_type_ratios != '{}'::jsonb
  GROUP BY cm.club_id, w.id, w.user_id, (w.workout_time AT TIME ZONE 'Asia/Seoul')::date
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage, calculated_at = EXCLUDED.calculated_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_club_mileage_month(p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
BEGIN
  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Seoul');
  v_end   := v_start + interval '1 month';

  DELETE FROM club_workout_mileage WHERE year = p_year AND month = p_month;

  -- 일반 운동
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    CASE
      WHEN cmc.enabled = true AND cmc.coefficient > 0
        THEN ROUND((w.value / cmc.coefficient)::numeric, 4)
      ELSE 0
    END,
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id
  LEFT JOIN club_mileage_configs cmc
    ON  cmc.club_id  = cm.club_id
    AND cmc.category = w.category
    AND (cmc.sub_type = w.sub_type OR (cmc.sub_type IS NULL AND w.sub_type IS NULL))
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND (w.sub_type_ratios IS NULL OR w.sub_type_ratios = '{}'::jsonb)
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage, calculated_at = EXCLUDED.calculated_at;

  -- 혼합 운동 (sub_type_ratios)
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    ROUND(SUM(
      CASE WHEN cmc.enabled = true AND cmc.coefficient > 0
        THEN w.value * (kv.value::text::numeric) / cmc.coefficient
        ELSE 0
      END
    )::numeric, 4),
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id
  CROSS JOIN LATERAL jsonb_each(w.sub_type_ratios) AS kv(key, value)
  LEFT JOIN club_mileage_configs cmc
    ON  cmc.club_id  = cm.club_id
    AND cmc.category = w.category
    AND cmc.sub_type = kv.key
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND w.sub_type_ratios IS NOT NULL AND w.sub_type_ratios != '{}'::jsonb
  GROUP BY cm.club_id, w.id, w.user_id, (w.workout_time AT TIME ZONE 'Asia/Seoul')::date
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage, calculated_at = EXCLUDED.calculated_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_club_workout_mileage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  club_rec    RECORD;
  mileage     NUMERIC;
  coeff       NUMERIC;
  kst_time    TIMESTAMPTZ;
  kst_year    INT;
  kst_month   INT;
  kst_date    DATE;
  ratio_key   TEXT;
  ratio_val   NUMERIC;
  target_row  workouts%ROWTYPE;
BEGIN
  -- DELETE: 스냅샷에서 제거
  IF TG_OP = 'DELETE' THEN
    DELETE FROM club_workout_mileage WHERE workout_id = OLD.id;
    RETURN OLD;
  END IF;

  target_row := NEW;

  -- UPDATE이고 값/시간/서브타입이 바뀌지 않았으면 스킵 (memo, proof_image 등 변경 무시)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.value = NEW.value
      AND OLD.workout_time = NEW.workout_time
      AND OLD.category = NEW.category
      AND (OLD.sub_type IS NOT DISTINCT FROM NEW.sub_type)
      AND (OLD.sub_type_ratios IS NOT DISTINCT FROM NEW.sub_type_ratios)
    THEN
      RETURN NEW;
    END IF;
    -- 마일리지 관련 필드가 바뀐 경우 기존 레코드 삭제 후 재계산
    DELETE FROM club_workout_mileage WHERE workout_id = NEW.id;
  END IF;

  -- KST 날짜 계산
  kst_time  := target_row.workout_time AT TIME ZONE 'Asia/Seoul';
  kst_year  := EXTRACT(YEAR  FROM kst_time)::INT;
  kst_month := EXTRACT(MONTH FROM kst_time)::INT;
  kst_date  := kst_time::DATE;

  -- 이 유저가 속한 모든 클럽에 대해 마일리지 계산 후 저장
  FOR club_rec IN
    SELECT club_id FROM club_members WHERE user_id = target_row.user_id
  LOOP
    mileage := 0;

    -- sub_type_ratios 있는 경우: 혼합 비율로 계산 (요가/복싱 등)
    IF target_row.sub_type_ratios IS NOT NULL
       AND target_row.sub_type_ratios != '{}'::jsonb
    THEN
      FOR ratio_key, ratio_val IN
        SELECT key, value::text::numeric
        FROM jsonb_each_text(target_row.sub_type_ratios)
      LOOP
        SELECT coefficient INTO coeff
        FROM club_mileage_configs
        WHERE club_id = club_rec.club_id
          AND category = target_row.category
          AND sub_type = ratio_key
          AND enabled  = true;

        IF FOUND AND coeff > 0 THEN
          mileage := mileage + (target_row.value * ratio_val / coeff);
        END IF;
      END LOOP;

    -- 단일 sub_type 또는 sub_type 없는 경우
    ELSE
      SELECT coefficient INTO coeff
      FROM club_mileage_configs
      WHERE club_id = club_rec.club_id
        AND category = target_row.category
        AND sub_type IS NOT DISTINCT FROM target_row.sub_type
        AND enabled  = true;

      IF FOUND AND coeff > 0 THEN
        mileage := target_row.value / coeff;
      END IF;
    END IF;

    -- UPSERT (mileage=0이어도 기록: 비활성 카테고리 추적 + 재활성화 시 재계산 가능)
    INSERT INTO club_workout_mileage (
      club_id, workout_id, user_id,
      mileage, year, month, workout_date,
      calculated_at
    ) VALUES (
      club_rec.club_id,
      target_row.id,
      target_row.user_id,
      mileage,
      kst_year, kst_month, kst_date,
      now()
    )
    ON CONFLICT ON CONSTRAINT club_workout_mileage_club_workout_unique
    DO UPDATE SET
      mileage      = EXCLUDED.mileage,
      year         = EXCLUDED.year,
      month        = EXCLUDED.month,
      workout_date = EXCLUDED.workout_date,
      calculated_at = EXCLUDED.calculated_at;

  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_club_mileage_configs(p_club_id uuid, p_configs jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();

  SELECT role INTO v_role
  FROM public.club_members
  WHERE club_members.club_id = p_club_id
    AND club_members.user_id = v_uid
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'DEBUG: auth.uid() is NULL';
  END IF;

  IF v_role NOT IN ('manager', 'vice-manager') THEN
    RAISE EXCEPTION 'DEBUG: uid=%, club_id=%, role=% (null means not a member)', v_uid, p_club_id, v_role;
  END IF;

  DELETE FROM public.club_mileage_configs WHERE club_id = p_club_id;

  INSERT INTO public.club_mileage_configs (club_id, category, sub_type, coefficient, enabled, updated_at)
  SELECT
    p_club_id,
    (r->>'category')::text,
    NULLIF(r->>'sub_type', '')::text,
    (r->>'coefficient')::numeric,
    (r->>'enabled')::boolean,
    now()
  FROM jsonb_array_elements(p_configs) AS r;
END;
$function$
;


  create policy "users_can_delete_account"
  on "public"."users"
  as permissive
  for delete
  to public
using (true);



  create policy "users_can_update_profile"
  on "public"."users"
  as permissive
  for update
  to public
using (true)
with check (true);



