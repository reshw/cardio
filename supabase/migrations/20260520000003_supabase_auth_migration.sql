-- Supabase Auth 마이그레이션
-- public.users에 auth.users(id)를 연결하는 auth_id 컬럼 추가

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.users.auth_id IS
  'Supabase Auth user ID. signInWithOAuth 후 link_or_create_user()로 연결됨.';

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users (auth_id);

-- ─────────────────────────────────────────────────────────────────
-- link_or_create_user
-- 카카오 OAuth 콜백에서 호출:
--   1) kakao_id로 기존 public.users 찾기 → auth_id 연결
--   2) 없으면 auth_id로 재확인 (재로그인)
--   3) 둘 다 없으면 신규 생성
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_or_create_user(
  p_auth_id      UUID,
  p_kakao_id     TEXT,
  p_email        TEXT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL,
  p_profile_image TEXT DEFAULT NULL
) RETURNS TABLE(user_id UUID, is_new BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_is_new  BOOLEAN := FALSE;
BEGIN
  -- 1. kakao_id로 기존 사용자 매핑
  SELECT id INTO v_user_id
  FROM public.users
  WHERE kakao_id = p_kakao_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users
    SET auth_id      = p_auth_id,
        profile_image = COALESCE(p_profile_image, profile_image),
        email         = COALESCE(p_email, email)
    WHERE id = v_user_id;

  ELSE
    -- 2. auth_id로 재확인 (재로그인·중복 방지)
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_id = p_auth_id
    LIMIT 1;

    IF v_user_id IS NULL THEN
      -- 3. 완전 신규 생성
      INSERT INTO public.users (
        username, display_name, email,
        kakao_id, provider, profile_image, auth_id
      ) VALUES (
        'kakao_' || p_kakao_id,
        COALESCE(p_display_name, '사용자'),
        p_email,
        p_kakao_id,
        'kakao',
        p_profile_image,
        p_auth_id
      )
      RETURNING id INTO v_user_id;
      v_is_new := TRUE;
    END IF;
  END IF;

  RETURN QUERY SELECT v_user_id, v_is_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_or_create_user(UUID, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;
