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
  SELECT id INTO v_user_id
  FROM public.users
  WHERE kakao_id = p_kakao_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users
    SET auth_id       = p_auth_id,
        display_name  = COALESCE(p_display_name, display_name),
        profile_image = COALESCE(p_profile_image, profile_image),
        email         = COALESCE(p_email, email),
        phone_number  = COALESCE(p_phone_number, phone_number),
        birthyear     = COALESCE(p_birthyear, birthyear),
        gender        = COALESCE(p_gender, gender)
    WHERE id = v_user_id;

  ELSE
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_id = p_auth_id
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      UPDATE public.users
      SET display_name = COALESCE(p_display_name, display_name),
          phone_number = COALESCE(p_phone_number, phone_number),
          birthyear    = COALESCE(p_birthyear, birthyear),
          gender       = COALESCE(p_gender, gender)
      WHERE id = v_user_id;

    ELSE
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
