-- ============================================================
-- 마일리지 제외 규칙을 실제 판정 로직에 반영
--   대상: (1) 실시간 트리거 sync_club_workout_mileage
--         (2) 소급 재계산 recalculate_club_mileage (by club)
--         (3) 계수 프리뷰 재계산 recalculate_club_mileage_custom
--   판정: enabled 규칙 중 category/sub_type 일치 + KST 날짜 BETWEEN date_from..date_to
--         + KST 시작시각 hour_from <= hour < hour_to. 매칭 시 mileage=0,
--         exclusion_rule_id/exclusion_snapshot 세팅.
--   ※ recalculate_club_mileage_month(all clubs) 는 앱/웹훅 미사용이라 미변경.
-- 계획: docs/plans/mileage-exclude-time-window.md (D1/D2)
-- ============================================================

-- ---------------------------------------------------------
-- (1) 실시간 트리거 — 신규/수정 workout 저장 시 제외 규칙 반영
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_club_workout_mileage()
RETURNS TRIGGER AS $$
DECLARE
  club_rec    RECORD;
  mileage     NUMERIC;
  coeff       NUMERIC;
  kst_time    TIMESTAMPTZ;
  kst_year    INT;
  kst_month   INT;
  kst_date    DATE;
  kst_hour    INT;
  ratio_key   TEXT;
  ratio_val   NUMERIC;
  target_row  workouts%ROWTYPE;
  excl_id     uuid;
  excl_name   text;
  excl_bg     text;
  excl_fg     text;
  excl_snap   jsonb;
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
    DELETE FROM club_workout_mileage WHERE workout_id = NEW.id;
  END IF;

  -- KST 날짜/시각 계산
  kst_time  := target_row.workout_time AT TIME ZONE 'Asia/Seoul';
  kst_year  := EXTRACT(YEAR  FROM kst_time)::INT;
  kst_month := EXTRACT(MONTH FROM kst_time)::INT;
  kst_date  := kst_time::DATE;
  kst_hour  := EXTRACT(HOUR  FROM kst_time)::INT;

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

    -- 제외 규칙 판정 (enabled 규칙 중 첫 매칭)
    excl_id := NULL; excl_snap := NULL;
    SELECT r.id, r.name, r.label_bg_color, r.label_fg_color
      INTO excl_id, excl_name, excl_bg, excl_fg
    FROM club_mileage_exclusion_rules r
    WHERE r.club_id  = club_rec.club_id
      AND r.enabled  = true
      AND r.category = target_row.category
      AND (
        r.sub_type IS NULL
        OR r.sub_type IS NOT DISTINCT FROM target_row.sub_type
        OR (target_row.sub_type_ratios IS NOT NULL AND target_row.sub_type_ratios ? r.sub_type)
      )
      AND kst_date BETWEEN r.date_from AND r.date_to
      AND kst_hour >= r.hour_from
      AND kst_hour <  r.hour_to
    ORDER BY r.created_at, r.id
    LIMIT 1;

    IF excl_id IS NOT NULL THEN
      mileage   := 0;
      excl_snap := jsonb_build_object(
        'name', excl_name, 'label_bg_color', excl_bg, 'label_fg_color', excl_fg
      );
    END IF;

    INSERT INTO club_workout_mileage (
      club_id, workout_id, user_id,
      mileage, year, month, workout_date,
      exclusion_rule_id, exclusion_snapshot,
      calculated_at
    ) VALUES (
      club_rec.club_id,
      target_row.id,
      target_row.user_id,
      mileage,
      kst_year, kst_month, kst_date,
      excl_id, excl_snap,
      now()
    )
    ON CONFLICT ON CONSTRAINT club_workout_mileage_club_workout_unique
    DO UPDATE SET
      mileage            = EXCLUDED.mileage,
      year               = EXCLUDED.year,
      month              = EXCLUDED.month,
      workout_date       = EXCLUDED.workout_date,
      exclusion_rule_id  = EXCLUDED.exclusion_rule_id,
      exclusion_snapshot = EXCLUDED.exclusion_snapshot,
      calculated_at      = EXCLUDED.calculated_at;

  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------
-- (2) 소급/설정변경 재계산 — 클럽+월 단위
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_club_mileage(p_club_id uuid, p_year int, p_month int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (club_id, workout_id, user_id, mileage, year, month, workout_date,
     exclusion_rule_id, exclusion_snapshot, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    CASE
      WHEN excl.id IS NOT NULL THEN 0
      WHEN cmc.enabled = true AND cmc.coefficient > 0
        THEN ROUND((w.value / cmc.coefficient)::numeric, 4)
      ELSE 0
    END,
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    excl.id,
    CASE WHEN excl.id IS NOT NULL THEN
      jsonb_build_object('name', excl.name, 'label_bg_color', excl.label_bg_color, 'label_fg_color', excl.label_fg_color)
    ELSE NULL END,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  LEFT JOIN club_mileage_configs cmc
    ON  cmc.club_id  = cm.club_id
    AND cmc.category = w.category
    AND (cmc.sub_type = w.sub_type OR (cmc.sub_type IS NULL AND w.sub_type IS NULL))
  LEFT JOIN LATERAL (
    SELECT r.id, r.name, r.label_bg_color, r.label_fg_color
    FROM club_mileage_exclusion_rules r
    WHERE r.club_id  = p_club_id
      AND r.enabled  = true
      AND r.category = w.category
      AND (r.sub_type IS NULL OR r.sub_type = w.sub_type)
      AND (w.workout_time AT TIME ZONE 'Asia/Seoul')::date BETWEEN r.date_from AND r.date_to
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) >= r.hour_from
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) <  r.hour_to
    ORDER BY r.created_at, r.id
    LIMIT 1
  ) excl ON true
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND (w.sub_type_ratios IS NULL OR w.sub_type_ratios = '{}'::jsonb)
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage,
                  exclusion_rule_id = EXCLUDED.exclusion_rule_id,
                  exclusion_snapshot = EXCLUDED.exclusion_snapshot,
                  calculated_at = EXCLUDED.calculated_at;

  -- 혼합 운동 (sub_type_ratios)
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date,
     exclusion_rule_id, exclusion_snapshot, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    CASE WHEN excl.id IS NOT NULL THEN 0 ELSE
      ROUND(SUM(
        CASE WHEN cmc.enabled = true AND cmc.coefficient > 0
          THEN w.value * (kv.value::text::numeric) / cmc.coefficient
          ELSE 0
        END
      )::numeric, 4)
    END,
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    excl.id,
    CASE WHEN excl.id IS NOT NULL THEN
      jsonb_build_object('name', excl.name, 'label_bg_color', excl.label_bg_color, 'label_fg_color', excl.label_fg_color)
    ELSE NULL END,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  CROSS JOIN LATERAL jsonb_each(w.sub_type_ratios) AS kv(key, value)
  LEFT JOIN club_mileage_configs cmc
    ON  cmc.club_id  = cm.club_id
    AND cmc.category = w.category
    AND cmc.sub_type = kv.key
  LEFT JOIN LATERAL (
    SELECT r.id, r.name, r.label_bg_color, r.label_fg_color
    FROM club_mileage_exclusion_rules r
    WHERE r.club_id  = p_club_id
      AND r.enabled  = true
      AND r.category = w.category
      AND (r.sub_type IS NULL OR w.sub_type_ratios ? r.sub_type)
      AND (w.workout_time AT TIME ZONE 'Asia/Seoul')::date BETWEEN r.date_from AND r.date_to
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) >= r.hour_from
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) <  r.hour_to
    ORDER BY r.created_at, r.id
    LIMIT 1
  ) excl ON true
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND w.sub_type_ratios IS NOT NULL AND w.sub_type_ratios != '{}'::jsonb
  GROUP BY cm.club_id, w.id, w.user_id, (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
           excl.id, excl.name, excl.label_bg_color, excl.label_fg_color
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage,
                  exclusion_rule_id = EXCLUDED.exclusion_rule_id,
                  exclusion_snapshot = EXCLUDED.exclusion_snapshot,
                  calculated_at = EXCLUDED.calculated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_club_mileage(uuid, int, int) TO authenticated;

-- ---------------------------------------------------------
-- (3) 계수 프리뷰 재계산 — 전달 계수 사용 + 제외 규칙도 반영
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_club_mileage_custom(
  p_club_id uuid,
  p_year    int,
  p_month   int,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
BEGIN
  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Seoul');
  v_end   := v_start + interval '1 month';

  DELETE FROM club_workout_mileage
  WHERE club_id = p_club_id AND year = p_year AND month = p_month;

  -- 일반 운동
  WITH cfg AS (
    SELECT
      elem->>'category'               AS category,
      elem->>'sub_type'               AS sub_type,
      (elem->>'coefficient')::numeric  AS coefficient,
      (elem->>'enabled')::boolean      AS enabled
    FROM jsonb_array_elements(p_configs) AS elem
  )
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date,
     exclusion_rule_id, exclusion_snapshot, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    CASE
      WHEN excl.id IS NOT NULL THEN 0
      WHEN c.enabled = true AND c.coefficient > 0
        THEN ROUND((w.value / c.coefficient)::numeric, 4)
      ELSE 0
    END,
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    excl.id,
    CASE WHEN excl.id IS NOT NULL THEN
      jsonb_build_object('name', excl.name, 'label_bg_color', excl.label_bg_color, 'label_fg_color', excl.label_fg_color)
    ELSE NULL END,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  LEFT JOIN cfg c
    ON  c.category = w.category
    AND (c.sub_type = w.sub_type OR (c.sub_type IS NULL AND w.sub_type IS NULL))
  LEFT JOIN LATERAL (
    SELECT r.id, r.name, r.label_bg_color, r.label_fg_color
    FROM club_mileage_exclusion_rules r
    WHERE r.club_id  = p_club_id
      AND r.enabled  = true
      AND r.category = w.category
      AND (r.sub_type IS NULL OR r.sub_type = w.sub_type)
      AND (w.workout_time AT TIME ZONE 'Asia/Seoul')::date BETWEEN r.date_from AND r.date_to
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) >= r.hour_from
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) <  r.hour_to
    ORDER BY r.created_at, r.id
    LIMIT 1
  ) excl ON true
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND (w.sub_type_ratios IS NULL OR w.sub_type_ratios = '{}'::jsonb)
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage,
                  exclusion_rule_id = EXCLUDED.exclusion_rule_id,
                  exclusion_snapshot = EXCLUDED.exclusion_snapshot,
                  calculated_at = EXCLUDED.calculated_at;

  -- 혼합 운동
  WITH cfg AS (
    SELECT
      elem->>'category'               AS category,
      elem->>'sub_type'               AS sub_type,
      (elem->>'coefficient')::numeric  AS coefficient,
      (elem->>'enabled')::boolean      AS enabled
    FROM jsonb_array_elements(p_configs) AS elem
  )
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date,
     exclusion_rule_id, exclusion_snapshot, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    CASE WHEN excl.id IS NOT NULL THEN 0 ELSE
      ROUND(SUM(
        CASE WHEN c.enabled = true AND c.coefficient > 0
          THEN w.value * (kv.value::text::numeric) / c.coefficient
          ELSE 0
        END
      )::numeric, 4)
    END,
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    excl.id,
    CASE WHEN excl.id IS NOT NULL THEN
      jsonb_build_object('name', excl.name, 'label_bg_color', excl.label_bg_color, 'label_fg_color', excl.label_fg_color)
    ELSE NULL END,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  CROSS JOIN LATERAL jsonb_each(w.sub_type_ratios) AS kv(key, value)
  LEFT JOIN cfg c
    ON  c.category = w.category
    AND c.sub_type = kv.key
  LEFT JOIN LATERAL (
    SELECT r.id, r.name, r.label_bg_color, r.label_fg_color
    FROM club_mileage_exclusion_rules r
    WHERE r.club_id  = p_club_id
      AND r.enabled  = true
      AND r.category = w.category
      AND (r.sub_type IS NULL OR w.sub_type_ratios ? r.sub_type)
      AND (w.workout_time AT TIME ZONE 'Asia/Seoul')::date BETWEEN r.date_from AND r.date_to
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) >= r.hour_from
      AND EXTRACT(HOUR FROM (w.workout_time AT TIME ZONE 'Asia/Seoul')) <  r.hour_to
    ORDER BY r.created_at, r.id
    LIMIT 1
  ) excl ON true
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND w.sub_type_ratios IS NOT NULL AND w.sub_type_ratios != '{}'::jsonb
  GROUP BY cm.club_id, w.id, w.user_id, (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
           excl.id, excl.name, excl.label_bg_color, excl.label_fg_color
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage,
                  exclusion_rule_id = EXCLUDED.exclusion_rule_id,
                  exclusion_snapshot = EXCLUDED.exclusion_snapshot,
                  calculated_at = EXCLUDED.calculated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_club_mileage_custom(uuid, int, int, jsonb) TO authenticated;
