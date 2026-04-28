-- RPC 함수 실행 권한: authenticated 사용자만 호출 가능
REVOKE EXECUTE ON FUNCTION update_club_mileage_configs(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_club_mileage_configs(uuid, jsonb) TO authenticated;
