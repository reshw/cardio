-- SELECT 정책도 true로 변경 (DELETE가 내부적으로 SELECT 정책 통과해야 작동함)
-- 읽기 접근은 앱 레이어에서 제어 (다른 테이블과 동일한 패턴)
DROP POLICY IF EXISTS "club_mileage_configs_select" ON club_mileage_configs;

CREATE POLICY "club_mileage_configs_select"
  ON club_mileage_configs FOR SELECT
  USING (true);
