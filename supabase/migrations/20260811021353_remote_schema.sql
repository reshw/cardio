create extension if not exists "pg_net" with schema "public";

drop policy "users_can_delete_account" on "public"."users";

drop policy "users_can_update_profile" on "public"."users";

revoke delete on table "public"."social_gathering_members" from "anon";

revoke insert on table "public"."social_gathering_members" from "anon";

revoke references on table "public"."social_gathering_members" from "anon";

revoke select on table "public"."social_gathering_members" from "anon";

revoke trigger on table "public"."social_gathering_members" from "anon";

revoke truncate on table "public"."social_gathering_members" from "anon";

revoke update on table "public"."social_gathering_members" from "anon";

revoke delete on table "public"."social_gathering_members" from "authenticated";

revoke insert on table "public"."social_gathering_members" from "authenticated";

revoke references on table "public"."social_gathering_members" from "authenticated";

revoke select on table "public"."social_gathering_members" from "authenticated";

revoke trigger on table "public"."social_gathering_members" from "authenticated";

revoke truncate on table "public"."social_gathering_members" from "authenticated";

revoke update on table "public"."social_gathering_members" from "authenticated";

revoke delete on table "public"."social_gathering_members" from "service_role";

revoke insert on table "public"."social_gathering_members" from "service_role";

revoke references on table "public"."social_gathering_members" from "service_role";

revoke select on table "public"."social_gathering_members" from "service_role";

revoke trigger on table "public"."social_gathering_members" from "service_role";

revoke truncate on table "public"."social_gathering_members" from "service_role";

revoke update on table "public"."social_gathering_members" from "service_role";

revoke delete on table "public"."social_gatherings" from "anon";

revoke insert on table "public"."social_gatherings" from "anon";

revoke references on table "public"."social_gatherings" from "anon";

revoke select on table "public"."social_gatherings" from "anon";

revoke trigger on table "public"."social_gatherings" from "anon";

revoke truncate on table "public"."social_gatherings" from "anon";

revoke update on table "public"."social_gatherings" from "anon";

revoke delete on table "public"."social_gatherings" from "authenticated";

revoke insert on table "public"."social_gatherings" from "authenticated";

revoke references on table "public"."social_gatherings" from "authenticated";

revoke select on table "public"."social_gatherings" from "authenticated";

revoke trigger on table "public"."social_gatherings" from "authenticated";

revoke truncate on table "public"."social_gatherings" from "authenticated";

revoke update on table "public"."social_gatherings" from "authenticated";

revoke delete on table "public"."social_gatherings" from "service_role";

revoke insert on table "public"."social_gatherings" from "service_role";

revoke references on table "public"."social_gatherings" from "service_role";

revoke select on table "public"."social_gatherings" from "service_role";

revoke trigger on table "public"."social_gatherings" from "service_role";

revoke truncate on table "public"."social_gatherings" from "service_role";

revoke update on table "public"."social_gatherings" from "service_role";

revoke delete on table "public"."social_points" from "anon";

revoke insert on table "public"."social_points" from "anon";

revoke references on table "public"."social_points" from "anon";

revoke select on table "public"."social_points" from "anon";

revoke trigger on table "public"."social_points" from "anon";

revoke truncate on table "public"."social_points" from "anon";

revoke update on table "public"."social_points" from "anon";

revoke delete on table "public"."social_points" from "authenticated";

revoke insert on table "public"."social_points" from "authenticated";

revoke references on table "public"."social_points" from "authenticated";

revoke select on table "public"."social_points" from "authenticated";

revoke trigger on table "public"."social_points" from "authenticated";

revoke truncate on table "public"."social_points" from "authenticated";

revoke update on table "public"."social_points" from "authenticated";

revoke delete on table "public"."social_points" from "service_role";

revoke insert on table "public"."social_points" from "service_role";

revoke references on table "public"."social_points" from "service_role";

revoke select on table "public"."social_points" from "service_role";

revoke trigger on table "public"."social_points" from "service_role";

revoke truncate on table "public"."social_points" from "service_role";

revoke update on table "public"."social_points" from "service_role";

alter table "public"."race_records" drop constraint "race_records_category_check";

alter table "public"."social_gathering_members" drop constraint "social_gathering_members_gathering_id_fkey";

alter table "public"."social_gathering_members" drop constraint "social_gathering_members_gathering_id_user_id_key";

alter table "public"."social_gathering_members" drop constraint "social_gathering_members_user_id_fkey";

alter table "public"."social_gatherings" drop constraint "social_gatherings_approved_by_fkey";

alter table "public"."social_gatherings" drop constraint "social_gatherings_club_id_fkey";

alter table "public"."social_gatherings" drop constraint "social_gatherings_created_by_fkey";

alter table "public"."social_gatherings" drop constraint "social_gatherings_status_check";

alter table "public"."social_points" drop constraint "social_points_action_type_check";

alter table "public"."social_points" drop constraint "social_points_awarded_by_fkey";

alter table "public"."social_points" drop constraint "social_points_club_id_fkey";

alter table "public"."social_points" drop constraint "social_points_user_id_fkey";

alter table "public"."social_gathering_members" drop constraint "social_gathering_members_pkey";

alter table "public"."social_gatherings" drop constraint "social_gatherings_pkey";

alter table "public"."social_points" drop constraint "social_points_pkey";

drop index if exists "public"."idx_social_gatherings_club";

drop index if exists "public"."idx_social_points_club_year_month";

drop index if exists "public"."idx_social_points_share_daily";

drop index if exists "public"."idx_social_points_user";

drop index if exists "public"."social_gathering_members_gathering_id_user_id_key";

drop index if exists "public"."social_gathering_members_pkey";

drop index if exists "public"."social_gatherings_pkey";

drop index if exists "public"."social_points_pkey";

drop table "public"."social_gathering_members";

drop table "public"."social_gatherings";

drop table "public"."social_points";

alter table "public"."clubs" drop column "mileage_filter_categories";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.app_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_notification_inserted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  begin
    perform net.http_post(
      url     := 'https://cardio.scnd.kr/api/webhooks/notification-inserted',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer silversh13'
      ),
      body    := jsonb_build_object(
        'type',   TG_OP,
        'table',  'notifications',
        'schema', 'public',
        'record', to_jsonb(NEW)
      )
    );
  exception when others then
    null; -- notifications INSERT는 웹훅 실패와 무관하게 성공
  end;
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_challenge_club_manager(p_challenge_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.challenges c
    JOIN public.club_members cm ON cm.club_id = c.club_id
    JOIN public.users pu ON pu.id = cm.user_id
    WHERE c.id = p_challenge_id
      AND pu.auth_id = auth.uid()
      AND cm.role IN ('manager', 'vice-manager')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_challenge_club_member(p_challenge_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.challenges c
    JOIN public.club_members cm ON cm.club_id = c.club_id
    JOIN public.users pu ON pu.id = cm.user_id
    WHERE c.id = p_challenge_id
      AND pu.auth_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.link_or_create_user(p_auth_id uuid, p_kakao_id text, p_email text DEFAULT NULL::text, p_display_name text DEFAULT NULL::text, p_profile_image text DEFAULT NULL::text, p_phone_number text DEFAULT NULL::text, p_birthyear text DEFAULT NULL::text, p_gender text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, is_new boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;


  create policy "allow overwrite"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'apk'::text));



  create policy "allow upload"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'apk'::text));



  create policy "public read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'apk'::text));



