-- 사용자 정의 계수로 클럽 월별 마일리지 재계산
-- p_configs: [{"category":text,"sub_type":text|null,"coefficient":numeric,"enabled":boolean}]
-- 클럽의 club_mileage_configs를 변경하지 않고, 전달된 계수를 그 월에만 적용
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

  -- 일반 운동 (sub_type_ratios 없음)
  WITH cfg AS (
    SELECT
      elem->>'category'               AS category,
      elem->>'sub_type'               AS sub_type,
      (elem->>'coefficient')::numeric  AS coefficient,
      (elem->>'enabled')::boolean      AS enabled
    FROM jsonb_array_elements(p_configs) AS elem
  )
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    CASE
      WHEN c.enabled = true AND c.coefficient > 0
        THEN ROUND((w.value / c.coefficient)::numeric, 4)
      ELSE 0
    END,
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  LEFT JOIN cfg c
    ON  c.category = w.category
    AND (c.sub_type = w.sub_type OR (c.sub_type IS NULL AND w.sub_type IS NULL))
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND (w.sub_type_ratios IS NULL OR w.sub_type_ratios = '{}'::jsonb)
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage, calculated_at = EXCLUDED.calculated_at;

  -- 혼합 운동 (sub_type_ratios)
  WITH cfg AS (
    SELECT
      elem->>'category'               AS category,
      elem->>'sub_type'               AS sub_type,
      (elem->>'coefficient')::numeric  AS coefficient,
      (elem->>'enabled')::boolean      AS enabled
    FROM jsonb_array_elements(p_configs) AS elem
  )
  INSERT INTO club_workout_mileage
    (club_id, workout_id, user_id, mileage, year, month, workout_date, calculated_at)
  SELECT
    cm.club_id, w.id, w.user_id,
    ROUND(SUM(
      CASE WHEN c.enabled = true AND c.coefficient > 0
        THEN w.value * (kv.value::text::numeric) / c.coefficient
        ELSE 0
      END
    )::numeric, 4),
    p_year, p_month,
    (w.workout_time AT TIME ZONE 'Asia/Seoul')::date,
    now()
  FROM workouts w
  JOIN club_members cm ON cm.user_id = w.user_id AND cm.club_id = p_club_id
  CROSS JOIN LATERAL jsonb_each(w.sub_type_ratios) AS kv(key, value)
  LEFT JOIN cfg c
    ON  c.category = w.category
    AND c.sub_type = kv.key
  WHERE w.workout_time >= v_start AND w.workout_time < v_end
    AND w.sub_type_ratios IS NOT NULL AND w.sub_type_ratios != '{}'::jsonb
  GROUP BY cm.club_id, w.id, w.user_id, (w.workout_time AT TIME ZONE 'Asia/Seoul')::date
  ON CONFLICT (club_id, workout_id)
    DO UPDATE SET mileage = EXCLUDED.mileage, calculated_at = EXCLUDED.calculated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_club_mileage_custom(uuid, int, int, jsonb) TO authenticated;
