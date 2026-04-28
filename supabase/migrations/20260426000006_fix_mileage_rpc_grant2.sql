-- REVOKE가 너무 광범위하게 적용됐으므로 모든 관련 롤에 재부여
GRANT EXECUTE ON FUNCTION public.update_club_mileage_configs(uuid, jsonb) TO postgres, anon, authenticated, service_role;
