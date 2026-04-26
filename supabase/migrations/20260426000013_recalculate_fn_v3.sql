CREATE OR REPLACE FUNCTION recalculate_club_mileage_month(p_year int, p_month int)
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
$$;

GRANT EXECUTE ON FUNCTION recalculate_club_mileage_month(int, int) TO authenticated;
