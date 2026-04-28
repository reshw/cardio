-- 디버그: auth.uid()와 실제 role 값을 에러 메시지에 포함
CREATE OR REPLACE FUNCTION update_club_mileage_configs(
  p_club_id uuid,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
  v_role text;
BEGIN
  v_uid := auth.uid();

  SELECT role INTO v_role
  FROM public.club_members
  WHERE club_members.club_id = p_club_id
    AND club_members.user_id = v_uid
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'DEBUG: auth.uid() is NULL';
  END IF;

  IF v_role NOT IN ('manager', 'vice-manager') THEN
    RAISE EXCEPTION 'DEBUG: uid=%, club_id=%, role=% (null means not a member)', v_uid, p_club_id, v_role;
  END IF;

  DELETE FROM public.club_mileage_configs WHERE club_id = p_club_id;

  INSERT INTO public.club_mileage_configs (club_id, category, sub_type, coefficient, enabled, updated_at)
  SELECT
    p_club_id,
    (r->>'category')::text,
    NULLIF(r->>'sub_type', '')::text,
    (r->>'coefficient')::numeric,
    (r->>'enabled')::boolean,
    now()
  FROM jsonb_array_elements(p_configs) AS r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_club_mileage_configs(uuid, jsonb) TO authenticated;
