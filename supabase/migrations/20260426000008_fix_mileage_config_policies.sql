-- 기존 복잡한 정책 모두 제거하고 프로젝트 패턴에 맞게 단순화
DROP POLICY IF EXISTS "club_mileage_configs_insert" ON club_mileage_configs;
DROP POLICY IF EXISTS "club_mileage_configs_update" ON club_mileage_configs;
DROP POLICY IF EXISTS "club_mileage_configs_delete" ON club_mileage_configs;

-- 다른 테이블과 동일한 패턴: authenticated 사용자 쓰기 허용 (앱 레이어에서 권한 관리)
CREATE POLICY "managers_can_insert_mileage_config"
  ON club_mileage_configs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "managers_can_update_mileage_config"
  ON club_mileage_configs FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "managers_can_delete_mileage_config"
  ON club_mileage_configs FOR DELETE
  USING (true);
