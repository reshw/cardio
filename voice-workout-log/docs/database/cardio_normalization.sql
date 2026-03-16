-- ============================================
-- Cardio Normalization Helper Functions
-- 유산소 환산 비율 적용을 위한 SQL 함수
-- ============================================

-- 운동명 → 카테고리 매핑 함수
CREATE OR REPLACE FUNCTION get_cardio_category(workout_name TEXT)
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- 카테고리 → 환산 비율 매핑 함수
CREATE OR REPLACE FUNCTION get_cardio_multiplier(category TEXT)
RETURNS NUMERIC AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- 환산 거리 계산 함수 (집계 시 사용)
-- 1순위: adjusted_dist_km (인클라인 보정된 거리)
-- 2순위: distance_km (원본 거리)
-- 그 후 cardio category multiplier 적용
CREATE OR REPLACE FUNCTION calculate_adjusted_distance(
  distance_km NUMERIC,
  adjusted_dist_km NUMERIC,
  workout_name TEXT
)
RETURNS NUMERIC AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;
