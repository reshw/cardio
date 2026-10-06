-- ============================================================================
-- 클럽달력: 날짜별 운동 갯수 + 클럽 기능 opt-out 전환
-- 계획: docs/plans/club-workout-calendar.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 클럽 기능 opt-in → opt-out
--
-- 기존 enabled_features("켠 것 목록")는 기본값 '{}' 라 모든 기능이 꺼진 채 시작했다.
-- 기본값만 뒤집으면 나중에 기능을 추가할 때마다 기존 클럽에선 또 꺼진 채로 시작해
-- 결국 opt-in 으로 되돌아간다. "끈 것 목록"을 저장해야 새 기능이 자동으로 켜진다.
--
-- 전 클럽 '{}' = 아무것도 안 끔 = 행사 기능 포함 전부 켜짐.
-- enabled_features 컬럼은 남겨둔다(웹은 더 이상 안 읽음). 네이티브가 읽고 있을
-- 가능성을 배제할 수 없어 지우지 않는다.
-- ----------------------------------------------------------------------------
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS disabled_features text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clubs.disabled_features IS
  '운영진이 끈 기능 키 목록 (opt-out). 비어 있으면 전부 켜짐. 예: {calendar} = 행사 기능 끔';
COMMENT ON COLUMN public.clubs.enabled_features IS
  'DEPRECATED (2026-10-06): disabled_features 로 대체. 웹은 더 이상 읽지 않음';

-- ----------------------------------------------------------------------------
-- 2. 날짜별 운동 갯수 RPC
--
-- 달력 숫자를 누르면 오늘운동 피드(getClubWorkoutFeed)가 그 날짜로 열리므로,
-- 두 숫자가 반드시 일치해야 한다 ("달력엔 5인데 눌러보니 4개"면 신뢰가 깨짐).
-- 그래서 피드와 정확히 같은 규칙으로 센다:
--   · club_members.show_in_feed = true 인 멤버의 workouts
--   · 내가 이 클럽에서 차단한 사람 제외 (user_blocks)
--   · 날짜는 한국 시각 기준 (피드가 브라우저 로컬=KST 자정 경계로 자른다)
--
-- club_workout_mileage 가 아니라 workouts 를 직접 세는 이유도 같다 — 피드의 출처가
-- workouts 다. 원본을 내리면 한 달 1,300건+ 로 PostgREST 1,000행 제한에 걸리므로
-- 서버에서 집계해서 날짜당 한 행만 내린다.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_club_workout_day_counts(
  p_club_id    uuid,
  p_start_date date,
  p_end_date   date,
  p_user_id    uuid DEFAULT NULL,   -- 사람 필터 (NULL = 전체)
  p_category   text DEFAULT NULL    -- 종목 필터 (NULL = 전체), workouts.category
)
RETURNS TABLE(workout_date date, workout_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (w.workout_time AT TIME ZONE 'Asia/Seoul')::date AS workout_date,
         count(*)                                         AS workout_count
  FROM workouts w
  JOIN club_members cm
    ON cm.user_id = w.user_id
   AND cm.club_id = p_club_id
   AND cm.show_in_feed = true
  WHERE w.workout_time >= (p_start_date::timestamp AT TIME ZONE 'Asia/Seoul')
    AND w.workout_time <  ((p_end_date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')
    AND (p_user_id  IS NULL OR w.user_id  = p_user_id)
    AND (p_category IS NULL OR w.category = p_category)
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE b.blocker_id = public.app_user_id()
        AND b.blocked_id = w.user_id
        AND b.club_id    = p_club_id
    )
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_workout_day_counts(uuid, date, date, uuid, text)
  TO anon, authenticated;
