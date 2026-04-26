-- authenticated 롤에 테이블 권한 명시적 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_mileage_configs TO authenticated;
GRANT SELECT ON public.club_mileage_configs TO anon;
