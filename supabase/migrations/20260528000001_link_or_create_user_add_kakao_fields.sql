-- link_or_create_user 확장: phone_number, birthyear, gender 저장 지원
CREATE OR REPLACE FUNCTION public.link_or_create_user(
  p_auth_id       UUID,
  p_kakao_id      TEXT,
  p_email         TEXT DEFAULT NULL,
  p_display_name  TEXT DEFAULT NULL,
  p_profile_image TEXT DEFAULT NULL,
  p_phone_number  TEXT DEFAULT NULL,
  p_birthyear     TEXT DEFAULT NULL,
  p_gender        TEXT DEFAULT NULL
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
    SET auth_id       = p_auth_id,
        profile_image = COALESCE(p_profile_image, profile_image),
        email         = COALESCE(p_email, email),
        phone_number  = COALESCE(p_phone_number, phone_number),
        birthyear     = COALESCE(p_birthyear, birthyear),
        gender        = COALESCE(p_gender, gender)
    WHERE id = v_user_id;

  ELSE
    -- 2. auth_id로 재확인 (재로그인·중복 방지)
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_id = p_auth_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      UPDATE public.users
      SET phone_number = COALESCE(p_phone_number, phone_number),
          birthyear    = COALESCE(p_birthyear, birthyear),
          gender       = COALESCE(p_gender, gender)
      WHERE id = v_user_id;

    ELSE
      -- 3. 완전 신규 생성
      INSERT INTO public.users (
        username, display_name, email,
        kakao_id, provider, profile_image, auth_id,
        phone_number, birthyear, gender
      ) VALUES (
        'kakao_' || p_kakao_id,
        COALESCE(p_display_name, '사용자'),
        p_email,
        p_kakao_id,
        'kakao',
        p_profile_image,
        p_auth_id,
        p_phone_number,
        p_birthyear,
        p_gender
      )
      RETURNING id INTO v_user_id;
      v_is_new := TRUE;
    END IF;
  END IF;

  RETURN QUERY SELECT v_user_id, v_is_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_or_create_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;
