-- Allow admins to update system_settings
-- Note: 앱 레벨에서 관리자 검증 필요 (Supabase Auth 미사용)

CREATE POLICY "admins_can_update_settings" ON public.system_settings
  FOR UPDATE
  USING (true)  -- 앱에서 관리자 체크
  WITH CHECK (true);

CREATE POLICY "admins_can_insert_settings" ON public.system_settings
  FOR INSERT
  WITH CHECK (true);  -- 앱에서 관리자 체크
