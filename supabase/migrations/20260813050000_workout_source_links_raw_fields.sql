-- ============================================================================
-- workout_source_links.raw_fields — 소스별 원본 필드 스냅샷 (thread 82 후속, and #90)
--
-- 배경: 현재 workout_source_links 는 승자 소스의 필드값만 workouts row 에
-- 반영하고 나머지 소스의 원본값(거리/심박/경로 등)은 버린다. "이 소스를
-- 우선으로 병합해줘" 같은 수동 재선택 기능을 만들려면, 각 소스가 링크될
-- 당시 갖고 있던 원본 필드를 어딘가 남겨둬야 한다.
--
-- 지금은 쓰는 곳이 없다 — and/app 이 동기화 시 채워 넣기 시작해야 값이
-- 쌓인다. 컬럼만 미리 열어 둬서 Phase 2 스키마를 다시 안 건드리게 한다.
-- ============================================================================

ALTER TABLE public.workout_source_links
  ADD COLUMN raw_fields jsonb;

COMMENT ON COLUMN public.workout_source_links.raw_fields IS
  '동기화 당시 이 소스가 갖고 있던 원본 필드 스냅샷(거리/심박/경로 등). '
  'and/app 이 링크 생성 시점에 채워 넣는다. 과거 링크는 NULL — 병합 후보에서 제외해야 함.';
