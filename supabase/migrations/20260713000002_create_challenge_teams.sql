-- ============================================
-- 팀 대항전: 팀 / 팀원 테이블
-- 팀 이름은 색깔 기반(홍/백/청/흑), color 컬럼에 hex 저장
-- ============================================

-- 1. 팀 테이블
CREATE TABLE IF NOT EXISTS public.challenge_teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  name          text NOT NULL,
  color         text NOT NULL,
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_teams_challenge_id
  ON public.challenge_teams(challenge_id);

-- 2. 팀원 테이블
CREATE TABLE IF NOT EXISTS public.challenge_team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES public.challenge_teams(id) ON DELETE CASCADE,
  challenge_id  uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_captain    boolean NOT NULL DEFAULT false,
  joined_via    text NOT NULL DEFAULT 'auto' CHECK (joined_via IN ('auto', 'self', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)   -- 한 매치에 한 팀만 소속
);

CREATE INDEX IF NOT EXISTS idx_challenge_team_members_challenge_id
  ON public.challenge_team_members(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_team_members_team_id
  ON public.challenge_team_members(team_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.challenge_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_team_members ENABLE ROW LEVEL SECURITY;

-- 같은 클럽원이면 팀 조회 가능
CREATE POLICY "팀 클럽원 조회"
  ON public.challenge_teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      JOIN public.club_members cm ON cm.club_id = c.club_id
      WHERE c.id = challenge_id
        AND cm.user_id = auth.uid()
    )
  );

-- 매니저/부매니저만 팀 관리
CREATE POLICY "팀 매니저 관리"
  ON public.challenge_teams FOR ALL
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

-- 같은 클럽원이면 팀원 조회 가능
CREATE POLICY "팀원 클럽원 조회"
  ON public.challenge_team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      JOIN public.club_members cm ON cm.club_id = c.club_id
      WHERE c.id = challenge_id
        AND cm.user_id = auth.uid()
    )
  );

-- 본인 자율 선택 참여 (미배정 상태에서 스스로 팀 선택)
--   UNIQUE (challenge_id, user_id) 제약이 중복 소속을 자동 차단
CREATE POLICY "팀원 본인 자율참여"
  ON public.challenge_team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.challenges c
      JOIN public.club_members cm ON cm.club_id = c.club_id
      WHERE c.id = challenge_id
        AND cm.user_id = auth.uid()
    )
  );

-- 매니저/부매니저는 팀원 배정·이동·삭제 전권
CREATE POLICY "팀원 매니저 관리"
  ON public.challenge_team_members FOR ALL
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
