-- ============================================================================
-- ensure_app_user RPC — kakao_id 없는 provider(Apple 등)의 신규 계정 생성용
--
-- 배경: link_or_create_user 는 p_kakao_id 를 필수로 받고 username 을
-- 'kakao_' || p_kakao_id 로 고정 생성해 카카오 전용이다. iOS LoginView.swift
-- 의 ensureUserExists() 는 지금까지 Apple 로그인 신규 유저를 public.users 에
-- 직접 INSERT 해왔는데, 20260813010000_rls_hardening.sql 의 users_insert_admin
-- 정책(WITH CHECK app_is_admin())이 이를 막아 Apple 신규가입이 전면 실패하게
-- 됐다 (app 인박스 #80). Android resolveAppUserId() 도 같은 이유로 막힘 (and #79).
--
-- Apple/Android 둘 다 처음부터 Supabase Auth 로 로그인하므로(카카오처럼 auth_id
-- 를 뒤늦게 붙인 레거시 계정이 없음) auth.uid() 자체가 이미 안정적인 식별자다.
-- 그래서 카카오처럼 provider-id 매칭 테이블 룩업이 필요 없고, "내 auth_id 로
-- users 행이 있으면 반환, 없으면 만든다" 만으로 충분하다.
--
-- id 를 auth_id 와 동일하게 넣는 이유: 기존 Apple 계정 4건이 이미 그렇게
-- (LoginView.swift 가 직접) 만들어져 있다 — 관례를 깨지 않기 위해 그대로 따른다.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_app_user(
  p_provider text,
  p_display_name text DEFAULT NULL,
  p_profile_image text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS TABLE(user_id uuid, is_new boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_user_id uuid;
  v_is_new  boolean := false;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 요청입니다';
  END IF;
  IF p_provider IS NULL OR p_provider = '' THEN
    RAISE EXCEPTION 'p_provider 는 필수입니다';
  END IF;

  SELECT id INTO v_user_id FROM public.users WHERE auth_id = v_auth_id LIMIT 1;

  IF v_user_id IS NULL THEN
    BEGIN
      INSERT INTO public.users (id, username, display_name, email, provider, profile_image, auth_id)
      VALUES (
        v_auth_id,
        p_provider || '_' || upper(substr(replace(v_auth_id::text, '-', ''), 1, 10)),
        COALESCE(p_display_name, '사용자'),
        p_email, p_provider, p_profile_image, v_auth_id
      )
      RETURNING id INTO v_user_id;
      v_is_new := true;
    EXCEPTION WHEN unique_violation THEN
      -- 동시 요청 레이스 — 이미 다른 트랜잭션이 만들었으면 그걸 반환
      SELECT id INTO v_user_id FROM public.users WHERE auth_id = v_auth_id LIMIT 1;
      v_is_new := false;
    END;
  ELSE
    UPDATE public.users
    SET display_name  = COALESCE(p_display_name, display_name),
        profile_image = COALESCE(p_profile_image, profile_image)
    WHERE id = v_user_id;
  END IF;

  RETURN QUERY SELECT v_user_id, v_is_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_app_user(text, text, text, text) TO authenticated;
