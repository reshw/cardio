-- ============================================================================
-- workout_source_links — 크로스소스 activity 정체성 통합 (app 인박스 #81)
--
-- 배경: 가민/스트라바/애플헬스가 같은 실제 운동을 각자 다른 UUID로 기록해서
-- workouts.source_activity_id(단일 컬럼) 만으론 "이미 올라갔나" 판정이 불안정
-- (동기화 체크 오작동, 삭제한 기록 부활, 기기 간 이중 업로드). 새 activity UUID를
-- 만들지 않고 workouts.id 를 그대로 쓰되, 소스별 매핑을 별도 장부 테이블로 분리한다.
-- 웹 프론트는 이 테이블을 읽지 않는다 — 순수 앱(iOS/Android) 동기화 판정용.
--
-- unlinked_at 이 NULL→now() 로 바뀌는 게 tombstone이다: 유저가 웹에서 활동을
-- 지우면 링크는 남고 workout_id 만 NULL이 되어, 앱이 다음 동기화 때 "처음 보는
-- UUID"로 착각해 되살리는 걸 막는다.
-- ============================================================================

CREATE TABLE public.workout_source_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id    uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform      text NOT NULL CHECK (platform IN ('ios', 'android')),
  source_uuid   text NOT NULL,
  source_name   text,
  quality_score integer NOT NULL DEFAULT 0,
  linked_at     timestamptz NOT NULL DEFAULT now(),
  unlinked_at   timestamptz,
  UNIQUE (platform, source_uuid)
);

CREATE INDEX workout_source_links_workout_id_idx ON public.workout_source_links (workout_id);
CREATE INDEX workout_source_links_user_platform_idx ON public.workout_source_links (user_id, platform);

ALTER TABLE public.workout_source_links ENABLE ROW LEVEL SECURITY;

-- 본인 것만 — anon 은 아예 정책이 없어 전면 차단 (다른 신규 테이블과 동일 패턴)
CREATE POLICY workout_source_links_all_own ON public.workout_source_links
  FOR ALL TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- workouts 삭제 시 관련 링크를 tombstone 처리 (workout_id 는 FK ON DELETE SET NULL 로
-- 이미 NULL이 된 뒤 이 트리거가 unlinked_at 을 찍는다). 시스템 부기용이라 다른 트리거
-- (sync_club_workout_mileage 등)와 동일하게 SECURITY DEFINER — 관리자가 타 유저
-- workouts 를 캐스케이드 삭제하는 경로에서도 정확히 찍히도록.
CREATE OR REPLACE FUNCTION public.stamp_workout_source_links_unlinked()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.workout_source_links
     SET unlinked_at = now()
   WHERE workout_id IS NULL
     AND unlinked_at IS NULL
     AND user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER workouts_unlink_stamp
  AFTER DELETE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.stamp_workout_source_links_unlinked();

-- 백필: source→platform 매핑이 명확한 것만.
-- apple_health→ios, google_health(Health Connect)→android 는 확실하지만,
-- strava(170건)는 iOS/Android 어느 쪽에서 연동됐는지 source 컬럼만으론 판별 불가해서
-- 이번 백필에서 제외한다 (잘못 android로 찍으면 iPhone+Strava 사용자 오분류).
-- and 쪽 source 값 확인 후 별도 백필 검토 — app 메시지 #81에서 이미 인지하고 있음.
INSERT INTO public.workout_source_links (workout_id, user_id, platform, source_uuid, source_name, quality_score)
SELECT id, user_id,
       CASE WHEN source = 'apple_health' THEN 'ios' ELSE 'android' END,
       source_activity_id, NULL, 0
  FROM public.workouts
 WHERE source_activity_id IS NOT NULL
   AND source IN ('apple_health', 'google_health')
ON CONFLICT (platform, source_uuid) DO NOTHING;
