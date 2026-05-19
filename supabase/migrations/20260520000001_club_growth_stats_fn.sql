DROP FUNCTION IF EXISTS get_club_growth_stats(uuid, integer, integer);

CREATE FUNCTION get_club_growth_stats(
  p_club_id uuid,
  p_year    int,
  p_month   int
)
RETURNS TABLE (
  user_id                   uuid,
  display_name              text,
  club_nickname             text,
  profile_image             text,
  curr_mileage              numeric,
  prev_mileage              numeric,
  prev_normalized           numeric,
  elapsed_days              int,
  growth_rate               numeric,
  workout_days              int,
  prev_workout_days         int,
  prev_workout_days_norm    numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH prev_period AS (
    SELECT
      CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year  END AS yr,
      CASE WHEN p_month = 1 THEN 12          ELSE p_month - 1 END AS mo
  ),
  date_params AS (
    SELECT
      EXTRACT(DAY FROM (MAKE_DATE(p_year, p_month, 1) - INTERVAL '1 day'))::int AS prev_month_days,
      CASE
        WHEN MAKE_DATE(p_year, p_month, 1) = DATE_TRUNC('month', CURRENT_DATE)::date
        THEN EXTRACT(DAY FROM CURRENT_DATE)::int
        ELSE EXTRACT(DAY FROM (MAKE_DATE(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'))::int
      END AS elapsed_days
  ),
  curr AS (
    SELECT
      cw.user_id,
      SUM(cw.mileage)                      AS total_mileage,
      COUNT(DISTINCT cw.workout_date)::int AS workout_days
    FROM club_workout_mileage cw
    WHERE cw.club_id = p_club_id
      AND cw.year    = p_year
      AND cw.month   = p_month
    GROUP BY cw.user_id
  ),
  prev AS (
    SELECT
      cw.user_id,
      SUM(cw.mileage)                      AS total_mileage,
      COUNT(DISTINCT cw.workout_date)::int AS workout_days
    FROM club_workout_mileage cw, prev_period pp
    WHERE cw.club_id = p_club_id
      AND cw.year    = pp.yr
      AND cw.month   = pp.mo
    GROUP BY cw.user_id
  )
  SELECT
    cm.user_id,
    COALESCE(u.display_name, u.username)::text AS display_name,
    cm.club_nickname,
    COALESCE(cm.club_profile_image, u.profile_image) AS profile_image,
    COALESCE(curr.total_mileage, 0)::numeric   AS curr_mileage,
    COALESCE(prev.total_mileage, 0)::numeric   AS prev_mileage,
    -- 전달 마일리지 × (경과일수 / 전달 총일수)
    CASE
      WHEN COALESCE(prev.total_mileage, 0) > 0 AND dp.prev_month_days > 0
        THEN ROUND((prev.total_mileage / dp.prev_month_days * dp.elapsed_days)::numeric, 1)
      ELSE NULL
    END AS prev_normalized,
    dp.elapsed_days,
    -- 성장률 = (이번달 - 기대값) / 기대값 × 100
    CASE
      WHEN COALESCE(prev.total_mileage, 0) > 0 AND dp.prev_month_days > 0
        THEN ROUND(
          (
            (COALESCE(curr.total_mileage, 0)
              - prev.total_mileage / dp.prev_month_days * dp.elapsed_days)
            / (prev.total_mileage / dp.prev_month_days * dp.elapsed_days)
            * 100
          )::numeric, 1
        )
      ELSE NULL
    END AS growth_rate,
    COALESCE(curr.workout_days, 0)             AS workout_days,
    COALESCE(prev.workout_days, 0)             AS prev_workout_days,
    -- 전달 운동일수 × (경과일수 / 전달 총일수)
    CASE
      WHEN COALESCE(prev.workout_days, 0) > 0 AND dp.prev_month_days > 0
        THEN ROUND((prev.workout_days::numeric / dp.prev_month_days * dp.elapsed_days), 1)
      ELSE NULL
    END AS prev_workout_days_norm
  FROM club_members cm
  JOIN users u ON u.id = cm.user_id
  CROSS JOIN date_params dp
  LEFT JOIN curr ON curr.user_id = cm.user_id
  LEFT JOIN prev ON prev.user_id = cm.user_id
  WHERE cm.club_id = p_club_id
  ORDER BY growth_rate DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION get_club_growth_stats(uuid, int, int) TO authenticated;
