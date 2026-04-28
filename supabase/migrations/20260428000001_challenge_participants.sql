-- ============================================
-- 챌린지 개편: challenge_participants 재설계
-- + challenges 테이블 제약 조건 완화
-- ============================================

-- 1. 구 challenge_participants 삭제 (구조가 완전히 다름)
DROP TABLE IF EXISTS public.challenge_participants CASCADE;

-- 2. 신규 challenge_participants 생성
CREATE TABLE public.challenge_participants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category      text NOT NULL,
  sub_type      text,
  target_value  numeric NOT NULL CHECK (target_value > 0),
  unit          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- 본인 참여 조회
CREATE POLICY "참여자 본인 조회"
  ON public.challenge_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 같은 클럽원이면 타인 참여 조회 가능
CREATE POLICY "클럽원 상호 조회"
  ON public.challenge_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      JOIN public.club_members cm ON cm.club_id = c.club_id
      WHERE c.id = challenge_id
        AND cm.user_id = auth.uid()
    )
  );

-- 본인 참여 등록
CREATE POLICY "참여 등록"
  ON public.challenge_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 매니저/부매니저만 삭제 가능 (참여 취소 불가)
CREATE POLICY "매니저 삭제"
  ON public.challenge_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      JOIN public.club_members cm ON cm.club_id = c.club_id
      WHERE c.id = challenge_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('manager', 'vice-manager')
    )
  );

-- 3. challenges 테이블 정리
-- goal_metric: NOT NULL 해제 + check constraint 완화
ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_goal_metric_check;

ALTER TABLE public.challenges
  ALTER COLUMN goal_metric DROP NOT NULL;

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_goal_metric_check
  CHECK (goal_metric IS NULL OR goal_metric = ANY (ARRAY[
    'total_workouts', 'total_volume', 'total_duration', 'total_distance', 'custom'
  ]));

-- goal_value: NOT NULL 해제
ALTER TABLE public.challenges
  ALTER COLUMN goal_value DROP NOT NULL;

-- status: ended 추가
ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_status_check;

UPDATE public.challenges SET status = 'ended' WHERE status IN ('completed', 'failed');

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_status_check
  CHECK (status = ANY (ARRAY['active', 'ended']));
