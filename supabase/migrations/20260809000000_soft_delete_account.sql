-- 본인 계정 탈퇴 (App Store Guideline 5.1.1(v) — 앱 내 계정 삭제).
--
-- 하드 삭제를 쓰지 않는 이유:
--   clubs.created_by 가 users(id) ON DELETE CASCADE 라, 클럽을 만든 사람이 탈퇴하면
--   클럽 자체가 지워지고 club_members / club_feeds / club_workout_mileage /
--   hall_of_fame 까지 연쇄 삭제된다. 탈퇴한 본인이 아니라 그 클럽 멤버 전원의
--   데이터가 날아간다.
--
-- 대신 소프트 삭제로 처리한다. 사용자 입장에서는 비가역이다:
--   auth_id / kakao_id 를 끊으므로 다시 로그인하면 완전히 새 계정으로 가입된다
--   (link_or_create_user 가 kakao_id → auth_id 순으로 찾는데 둘 다 비었으므로 INSERT 로 간다).
--   username 도 UNIQUE 라 'deleted_<id>' 로 비켜준다. 안 그러면 재가입 INSERT 가 충돌한다.
--
-- 원본 값은 deleted_snapshot(jsonb) 에 담아두어 운영자가 복구할 수 있게 한다.
-- 개인정보처리방침의 "탈퇴 후 부정 이용 방지 목적으로 1년 보관 후 파기" 조항과 일치한다.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON public.users (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 호출자 자신의 계정만 탈퇴시킨다. auth.uid() 는 auth.users.id 이므로
-- public.users 와는 auth_id 로 매핑해야 한다 (id 와 직접 비교하면 안 됨).
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_user    public.users%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION '로그인 상태가 아닙니다.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE auth_id = v_auth_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION '탈퇴할 계정을 찾을 수 없습니다.' USING ERRCODE = 'P0002';
  END IF;

  -- 클럽장/부매니저는 자리를 비우고 나가야 한다. 클라이언트에서도 먼저 막지만,
  -- 서버에서도 한 번 더 확인한다.
  IF EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = v_user.id AND role IN ('manager', 'vice-manager')
  ) THEN
    RAISE EXCEPTION '클럽장 또는 부매니저는 클럽을 양도한 뒤 탈퇴할 수 있습니다.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.users
  SET deleted_at = now(),
      deleted_snapshot = jsonb_build_object(
        'auth_id',       v_user.auth_id,
        'kakao_id',      v_user.kakao_id,
        'username',      v_user.username,
        'display_name',  v_user.display_name,
        'email',         v_user.email,
        'profile_image', v_user.profile_image,
        'phone_number',  v_user.phone_number,
        'birthyear',     v_user.birthyear,
        'gender',        v_user.gender
      ),
      -- 재로그인 시 이 row 로 다시 연결되지 않도록 식별자를 끊는다
      auth_id       = NULL,
      kakao_id      = NULL,
      username      = 'deleted_' || v_user.id::text,
      -- 다른 멤버에게 노출되는 개인정보 제거 (기록 자체는 클럽 집계 정합성 때문에 남긴다)
      display_name  = '탈퇴한 사용자',
      email         = NULL,
      profile_image = NULL,
      phone_number  = NULL,
      birthyear     = NULL,
      gender        = NULL,
      is_admin      = FALSE,
      is_super_admin = FALSE,
      is_sub_admin  = FALSE
  WHERE id = v_user.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
