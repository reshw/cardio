-- ============================================================================
-- 헬스 동기화 소급 유입 차단 (user_sync_settings + workouts BEFORE INSERT 가드)
--
-- 문제: 사용자가 앱에서 건강 데이터 연동을 켜면 과거 기록이 전부 소급 유입돼
-- 자기 기록 목록이 뒤덮인다. 실제로 다수 사용자가 수동으로 지워야 했다.
--
-- 어떤 기록을 가져올지 판단하는 로직은 네이티브(iOS/Android)에 있지만, 스토어
-- 심사를 기다리지 않고 구버전 앱에도 즉시 먹여야 해서 DB 에서 막는다.
--
-- RLS(WITH CHECK) 가 아니라 트리거를 쓴 이유: RLS 거부는 에러를 던지므로 앱이
-- 여러 건을 한 문장으로 INSERT 하면 오래된 1건 때문에 배치 전체가 실패해
-- 새 기록까지 안 들어간다. BEFORE INSERT 에서 RETURN NULL 하면 문제 행만
-- 조용히 빠지고 나머지는 정상 저장된다.
--
-- ⚠️ and/app 참고: 건너뛴 행은 결과에 안 담긴다. `.select().single()` 로 넣으면
--    "0 rows" 에러처럼 보이므로, 이를 실패가 아니라 "정책상 스킵"으로 다뤄야 한다.
-- ============================================================================

CREATE TABLE public.user_sync_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- workouts.source 와 같은 값을 쓴다 ('apple_health' | 'google_health' | 'strava')
  provider   text NOT NULL,
  -- 이 시각 이후 시작한 운동만 가져온다. NULL = 제한 없음(사용자가 "전체"를 선택).
  sync_from  timestamptz,
  -- 사용자가 토글 ON 시 실제로 무엇을 골랐는지. 지원 문의 대응·정책 변경 추적용.
  -- 'none'(지금부터) | '1w' | '1m' | 'all' | 'auto_pending'(아래 자동 앵커)
  backfill_choice text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.user_sync_settings ENABLE ROW LEVEL SECURITY;

-- 본인 것만. anon 은 정책이 없어 전면 차단 (게스트는 헬스 연동 대상이 아님)
CREATE POLICY user_sync_settings_all_own ON public.user_sync_settings
  FOR ALL TO authenticated
  USING      (user_id = (SELECT public.app_user_id()))
  WITH CHECK (user_id = (SELECT public.app_user_id()));

-- ============================================================================
-- 가드 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_health_sync_backfill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sync_from timestamptz;
  v_found     boolean;
BEGIN
  -- 헬스 동기화 소스만 대상. 수동 입력·스트라바는 그대로 통과시킨다.
  IF NEW.source IS NULL OR NEW.source NOT IN ('apple_health', 'google_health') THEN
    RETURN NEW;
  END IF;

  SELECT s.sync_from, true INTO v_sync_from, v_found
  FROM public.user_sync_settings s
  WHERE s.user_id = NEW.user_id AND s.provider = NEW.source;

  IF NOT COALESCE(v_found, false) THEN
    -- 아직 아무것도 고른 적 없음 = 선택 UI 가 없는 구버전 앱.
    -- 보수적으로 "지금"에 앵커를 고정해 과거 백로그 유입을 막는다.
    -- 앱이 선택 UI 를 붙이면 사용자가 고른 값으로 이 행을 덮어쓴다.
    INSERT INTO public.user_sync_settings (user_id, provider, sync_from, backfill_choice)
    VALUES (NEW.user_id, NEW.source, now(), 'auto_pending')
    ON CONFLICT (user_id, provider) DO NOTHING;

    SELECT s.sync_from INTO v_sync_from
    FROM public.user_sync_settings s
    WHERE s.user_id = NEW.user_id AND s.provider = NEW.source;
  END IF;

  -- NULL = 제한 없음(사용자가 "전체" 선택)
  IF v_sync_from IS NOT NULL AND NEW.workout_time < v_sync_from THEN
    RETURN NULL;  -- 조용히 건너뛴다 (에러 없음 → 같은 배치의 새 기록은 정상 저장)
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_health_sync_backfill ON public.workouts;
CREATE TRIGGER guard_health_sync_backfill
  BEFORE INSERT ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.guard_health_sync_backfill();
