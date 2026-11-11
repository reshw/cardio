-- ============================================================================
-- club_relay v3 — 멈춘 곳 사진(필수)
--
-- 멈춘 곳 이름만으로는 다음 주자가 정확한 출발 지점을 찾기 어렵다.
-- 표지판·다리·인증센터 등 지점을 알아볼 수 있는 사진 한 장을 필수로 남긴다.
-- 기존 행(샘플)은 사진이 없을 수 있어 컬럼은 nullable, 필수 검사는 RPC 에서 한다.
-- ============================================================================

ALTER TABLE public.relay_legs ADD COLUMN end_photo_url text;

DROP FUNCTION IF EXISTS public.relay_complete_leg(uuid, numeric, text, uuid, text);

CREATE OR REPLACE FUNCTION public.relay_complete_leg(
  p_relay_id   uuid,
  p_km         numeric,
  p_end_name   text,
  p_end_photo  text,
  p_workout_id uuid DEFAULT NULL,
  p_note       text DEFAULT NULL
)
RETURNS public.relay_legs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid;
  v_relay public.relay_challenges;
  v_prev  public.relay_legs;
  v_next  integer;
  v_sum   numeric;
  v_end   text := nullif(trim(p_end_name), '');
  v_row   public.relay_legs;
BEGIN
  SELECT id INTO v_uid FROM public.users WHERE auth_id = auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_relay FROM public.relay_challenges WHERE id = p_relay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '이어달리기를 찾을 수 없습니다 (%)', p_relay_id;
  END IF;
  IF v_relay.status <> 'active' THEN
    RAISE EXCEPTION '이미 끝난 이어달리기입니다 (status=%)', v_relay.status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = v_relay.club_id AND user_id = v_uid) THEN
    RAISE EXCEPTION '클럽 회원만 인증할 수 있습니다';
  END IF;
  IF p_km IS NULL OR p_km <= 0 OR p_km > 300 THEN
    RAISE EXCEPTION '달린 거리는 0km 초과 300km 이하로 입력해 주세요 (입력: %)', p_km;
  END IF;
  IF v_end IS NULL THEN
    RAISE EXCEPTION '멈춘 곳(도착 지점) 이름을 입력해 주세요';
  END IF;
  IF char_length(v_end) > 60 THEN
    RAISE EXCEPTION '도착 지점 이름은 60자 이내로 입력해 주세요 (%자)', char_length(v_end);
  END IF;
  IF nullif(trim(p_end_photo), '') IS NULL THEN
    RAISE EXCEPTION '멈춘 곳 사진을 올려 주세요 — 다음 사람이 출발 지점을 찾는 데 필요해요';
  END IF;
  IF p_end_photo !~ '^https://' THEN
    RAISE EXCEPTION '사진 주소가 올바르지 않습니다 (%)', left(p_end_photo, 40);
  END IF;
  IF p_workout_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workouts WHERE id = p_workout_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION '본인 운동 기록만 연결할 수 있습니다';
  END IF;

  SELECT * INTO v_prev FROM public.relay_legs WHERE relay_id = p_relay_id ORDER BY leg_no DESC LIMIT 1;
  v_next := coalesce(v_prev.leg_no + 1, 0);

  INSERT INTO public.relay_legs (relay_id, leg_no, user_id, workout_id, note, km, start_name, end_name, end_photo_url)
  VALUES (p_relay_id, v_next, v_uid, p_workout_id, nullif(trim(p_note), ''), round(p_km, 2),
          coalesce(v_prev.end_name, v_relay.start_name), v_end, trim(p_end_photo))
  RETURNING * INTO v_row;

  SELECT sum(km) INTO v_sum FROM public.relay_legs WHERE relay_id = p_relay_id;
  IF v_sum >= v_relay.total_km THEN
    UPDATE public.relay_challenges SET status = 'finished', finished_at = now() WHERE id = p_relay_id;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.relay_complete_leg(uuid, numeric, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.relay_complete_leg(uuid, numeric, text, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.relay_complete_leg(uuid, numeric, text, text, uuid, text) TO authenticated;
