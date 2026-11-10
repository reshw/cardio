-- ============================================================================
-- 긴급 롤백 — users 테이블만 20260813010000_rls_hardening.sql 이전 상태로 복구
--
-- 사고: 2026-08-13 정오, RLS 정비 적용 직후 and/app(Android/iOS 네이티브) 사용자
-- 다수가 로그인 불가 보고. 원인은 users 컬럼 단위 SELECT 권한 회수(§10) —
-- 네이티브 클라이언트가 로그인 후 `select('*')` 로 본인 프로필을 조회하는데,
-- 컬럼 GRANT 는 "본인 행인지"를 구분 못 하고 role 전체에 적용되어 이미 로그인한
-- authenticated 사용자의 자기 자신 조회까지 막아버렸다. 웹은 get_my_account()
-- RPC로 이미 우회하고 있어 영향 없었음 — and/app 은 아직 RPC로 전환 못 한 상태.
--
-- 조치: users 의 RLS 정책 + 컬럼 권한을 정비 이전 상태로 전면 복구한다.
-- guard_users_privileged_columns 트리거는 그대로 둔다 — 전면 개방 상태에서도
-- is_admin/is_sub_admin/is_super_admin/auth_id/id 자가 변경은 계속 차단된다.
-- 다른 테이블(workouts/notifications/reports/club_members 등)은 로그인과 무관하므로
-- 그대로 둔다 — 이 사고로 검증된 실제 원인은 users 컬럼 락뿐이다.
--
-- ⚠️ 이로써 §1-2 의 PII 노출(email/phone/birthyear/gender, anon 포함 전체 공개)이
--    되살아난다. and/app 이 get_my_account() 동급 RPC로 전환 완료할 때까지의
--    임시 조치. 완료되면 §10 을 다시 적용해야 한다.
-- ============================================================================

DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert_admin ON public.users;
DROP POLICY IF EXISTS users_update_self_or_superadmin ON public.users;
DROP POLICY IF EXISTS users_delete_admin ON public.users;

CREATE POLICY "Enable all for users" ON public.users FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;
