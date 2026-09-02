-- ============================================================================
-- 헬스 동기화 소급 = "지금부터"로 고정 (사용자 범위 선택 제거)
--
-- 배경: 20260901000000_health_sync_backfill_guard.sql 로 소급 유입을 막고 앱에
-- "소급 범위 선택 UI"를 붙이기로 했으나, web 이 and/app 에 보낸 스펙
-- (cardio-comms #95)에 `backfill_choice: 'none'|'1w'|'1m'|'all'` + `sync_from
-- NULL = 전체` 가 들어가 있었다. workouts 가드 트리거가 클라이언트 sync_from 을
-- 상한 없이 신뢰하는 구조라 "전체"/"1개월" 을 고르면 가드가 통째로 무력화된다.
-- (v8.73 / iOS 빌드45 에 그대로 나갔으나 프로덕션 확인 결과 그 옵션을 고른
--  사용자 0명 — 데이터 피해 없이 발견.)
--
-- 결정: 범위 선택을 없앤다. 헬스 연동은 "지금부터"만. 과거 기록은 절대 소급
-- 유입하지 않는다 (원 민원이 "과거 기록이 목록을 뒤덮는다" 였으므로 완전 차단이
-- 안전). strava 등 다른 provider 는 영향 없음.
--
-- 구현:
--  (1) user_sync_settings 에 헬스 provider 로 write 되는 sync_from 을 now() 밑으로
--      못 내려가게 클램프하는 트리거. 클라가 과거 시각/NULL 을 보내도 연동 시점부터만.
--  (2) workouts BEFORE INSERT 가드에서 헬스 sync_from 이 NULL(레거시)이면 소급 차단.
--  (3) 기존 헬스 행 중 sync_from IS NULL 인 것만 now() 로 메꾼다
--      (past 값은 이미 제 역할을 하고 있고 앞당기면 같은날 기록을 놓칠 수 있어 안 건드림).
-- ============================================================================

-- (1) user_sync_settings write 가드 — 헬스는 sync_from 이 now() 이전이 될 수 없다
CREATE OR REPLACE FUNCTION public.clamp_health_sync_from()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.provider IN ('apple_health', 'google_health') THEN
    -- NULL(="전체") 또는 과거 시각 → 연동 시점(now())으로 끌어올림.
    -- now() 이후로 미루는 건 사용자 의도일 수 있어 그대로 둔다.
    NEW.sync_from := GREATEST(COALESCE(NEW.sync_from, now()), now());
    -- 과거 소급을 뜻하던 선택값은 전부 'none'(지금부터)으로 표기 정리 (감사 로그용)
    IF NEW.backfill_choice IS NULL OR NEW.backfill_choice IN ('1w', '1m', 'all') THEN
      NEW.backfill_choice := 'none';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS clamp_health_sync_from ON public.user_sync_settings;
CREATE TRIGGER clamp_health_sync_from
  BEFORE INSERT OR UPDATE ON public.user_sync_settings
  FOR EACH ROW EXECUTE FUNCTION public.clamp_health_sync_from();

-- (2) workouts 가드 — 헬스는 sync_from 이 NULL 이어도 소급 불가 (이중 안전장치)
CREATE OR REPLACE FUNCTION public.guard_health_sync_backfill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sync_from timestamptz;
  v_found     boolean;
BEGIN
  IF NEW.source IS NULL OR NEW.source NOT IN ('apple_health', 'google_health') THEN
    RETURN NEW;
  END IF;

  SELECT s.sync_from, true INTO v_sync_from, v_found
  FROM public.user_sync_settings s
  WHERE s.user_id = NEW.user_id AND s.provider = NEW.source;

  IF NOT COALESCE(v_found, false) THEN
    INSERT INTO public.user_sync_settings (user_id, provider, sync_from, backfill_choice)
    VALUES (NEW.user_id, NEW.source, now(), 'none')
    ON CONFLICT (user_id, provider) DO NOTHING;

    SELECT s.sync_from INTO v_sync_from
    FROM public.user_sync_settings s
    WHERE s.user_id = NEW.user_id AND s.provider = NEW.source;
  END IF;

  -- 헬스는 sync_from 이 NULL(레거시 "전체" 행)이어도 과거 소급 금지.
  -- 단 "전부 차단"이 아니라 "지금부터"로 간주 — 과거만 스킵, 신규 기록은 통과.
  IF v_sync_from IS NULL THEN
    v_sync_from := now();
  END IF;

  IF NEW.workout_time < v_sync_from THEN
    RETURN NULL;  -- 조용히 스킵 (같은 배치의 새 기록은 정상 저장)
  END IF;

  RETURN NEW;
END $$;

-- (3) 레거시 데이터 메꿈 — NULL sync_from 헬스 행만
UPDATE public.user_sync_settings
SET sync_from = now(),
    backfill_choice = COALESCE(NULLIF(backfill_choice, 'all'), 'none'),
    updated_at = now()
WHERE provider IN ('apple_health', 'google_health')
  AND sync_from IS NULL;

-- (4) 스키마 주석 갱신
COMMENT ON COLUMN public.user_sync_settings.sync_from IS
  '이 시각 이후 시작한 운동만 가져온다. 헬스(apple/google)는 clamp_health_sync_from 트리거가 now() 이전으로 못 내려가게 강제 → 사실상 "지금부터" 고정. strava 등은 자유.';
COMMENT ON COLUMN public.user_sync_settings.backfill_choice IS
  '사용자가 무엇을 골랐는지 (감사용). 헬스는 "지금부터"만 지원 → 항상 ''none'' 또는 ''auto_pending''. strava 등은 자유.';
