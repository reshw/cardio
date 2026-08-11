-- ============================================
-- 챌린지 타입 컬럼 추가 (팀 대항전 지원)
-- personal_goal: 기존 개인 목표 챌린지
-- team_match:    팀 대항 마일리지 매치 (신규)
-- ============================================

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS challenge_type text NOT NULL DEFAULT 'personal_goal';

ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_challenge_type_check;

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_challenge_type_check
  CHECK (challenge_type IN ('personal_goal', 'team_match'));

-- 기존 챌린지는 전부 개인 목표형으로 유지 (DEFAULT로 자동 처리됨)

COMMENT ON COLUMN public.challenges.challenge_type IS
  'personal_goal: 개인 목표 챌린지 / team_match: 팀 대항 마일리지 매치';
