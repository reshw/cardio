-- ============================================
-- 클럽 달력: 행사 등록 폼 재단순화
-- 구조화 필드(집결장소/짐보관/코스/장비/난이도)를 메모 한 줄로 합친 뒤로
-- 실제로 안 쓰여 컬럼만 남아있던 것들을 정리하고, 종목 자유입력 컬럼을 추가한다.
-- ============================================

ALTER TABLE public.club_events
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS baggage_info,
  DROP COLUMN IF EXISTS course,
  DROP COLUMN IF EXISTS gear_info,
  DROP COLUMN IF EXISTS difficulty,
  ADD COLUMN IF NOT EXISTS category_text text;  -- 종목 자유입력 (예: LSD, 인터벌 러닝) — 검증/필터 없음
