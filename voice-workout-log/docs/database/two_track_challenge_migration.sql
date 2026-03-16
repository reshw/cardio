-- Two-Track Challenge System Migration
-- 기존 club_challenges를 challenges로 통합하여 Global + Club 챌린지를 모두 지원

-- ============================================
-- 1. 새로운 challenges 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 1. 식별 및 범위 (Scope)
  scope TEXT NOT NULL CHECK (scope IN ('global', 'club')),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE, -- global이면 NULL, club이면 필수
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,

  -- 2. 기본 정보
  title TEXT NOT NULL,
  description TEXT,

  -- 3. 승리 조건 (Core Logic) - 쿼리 필터링용
  -- 측정 지표는 무엇인가?
  goal_metric TEXT NOT NULL CHECK (goal_metric IN ('total_workouts', 'total_volume', 'total_duration', 'total_distance')),
  -- 목표 값은 얼마인가?
  goal_value INTEGER NOT NULL,
  -- 현재 달성 값
  current_value INTEGER DEFAULT 0,

  -- 4. 기간 설정
  start_date TEXT NOT NULL, -- YYYY-MM-DD
  end_date TEXT NOT NULL,   -- YYYY-MM-DD

  -- 5. 상태
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),

  -- 6. 컨텍스트 & 밈 (JSONB 활용)
  -- Global: { "season": "2026-Winter", "tier": "gold", "badge_url": "..." }
  -- Club: { "bet_mode": true, "penalty": "댄스영상 올리기", "meme_image": "..." }
  meta_data JSONB DEFAULT '{}',

  -- 7. 확장성 (Forking)
  origin_challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,

  -- 8. 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 무결성 제약조건: club 스코프인데 club_id가 없으면 에러
ALTER TABLE challenges
ADD CONSTRAINT check_club_scope
CHECK (
  (scope = 'global' AND club_id IS NULL) OR
  (scope = 'club' AND club_id IS NOT NULL)
);

-- ============================================
-- 2. 인덱스 생성 (부분 인덱스로 최적화)
-- ============================================

-- 글로벌 챌린지용 인덱스
CREATE INDEX IF NOT EXISTS idx_challenges_global
ON challenges(start_date, end_date, status)
WHERE scope = 'global';

-- 클럽 챌린지용 인덱스 (클럽 ID로 파티셔닝 효과)
CREATE INDEX IF NOT EXISTS idx_challenges_club
ON challenges(club_id, start_date, end_date, status)
WHERE scope = 'club';

-- 범위 검색용
CREATE INDEX IF NOT EXISTS idx_challenges_scope ON challenges(scope);

-- 상태 검색용
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

-- ============================================
-- 3. 챌린지 참가자 테이블 (기존 challenge_contributions와 통합)
-- ============================================

-- 기존 challenge_contributions 테이블을 그대로 사용하되,
-- 테이블명을 challenge_participants로 변경하여 의미를 명확히 함
CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  contribution_value INTEGER NOT NULL,
  contributed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, workout_log_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_workout_log_id ON challenge_participants(workout_log_id);

-- ============================================
-- 4. 기존 데이터 마이그레이션
-- ============================================

-- 기존 club_challenges 데이터를 challenges로 복사
INSERT INTO challenges (
  id,
  scope,
  club_id,
  created_by,
  title,
  description,
  goal_metric,
  goal_value,
  current_value,
  start_date,
  end_date,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  'club' as scope, -- 모든 기존 챌린지는 club 스코프
  club_id,
  created_by,
  title,
  description,
  challenge_type as goal_metric,
  target_value as goal_value,
  current_value,
  start_date,
  end_date,
  status,
  created_at,
  updated_at
FROM club_challenges
WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE challenges.id = club_challenges.id);

-- 기존 challenge_contributions 데이터를 challenge_participants로 복사
INSERT INTO challenge_participants (
  id,
  challenge_id,
  user_id,
  workout_log_id,
  contribution_value,
  contributed_at
)
SELECT
  id,
  challenge_id,
  user_id,
  workout_log_id,
  contribution_value,
  contributed_at
FROM challenge_contributions
WHERE NOT EXISTS (SELECT 1 FROM challenge_participants WHERE challenge_participants.id = challenge_contributions.id);

-- ============================================
-- 5. 트리거 설정
-- ============================================

DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. RLS (Row Level Security) 정책
-- ============================================

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거
DROP POLICY IF EXISTS "Anyone can view global challenges" ON challenges;
DROP POLICY IF EXISTS "Club members can view club challenges" ON challenges;
DROP POLICY IF EXISTS "Owners and admins can create club challenges" ON challenges;
DROP POLICY IF EXISTS "Owners and admins can update club challenges" ON challenges;
DROP POLICY IF EXISTS "Owners and admins can delete club challenges" ON challenges;

-- 조회 정책
CREATE POLICY "Anyone can view global challenges"
ON challenges FOR SELECT
USING (scope = 'global');

CREATE POLICY "Club members can view club challenges"
ON challenges FOR SELECT
USING (
  scope = 'club' AND
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = challenges.club_id
    AND cm.user_id = auth.uid()
  )
);

-- 생성 정책 (글로벌은 DB에서 직접 생성, 클럽 owner/admin은 club 생성 가능)
-- Note: Global challenges are created directly in DB by developers
-- CREATE POLICY "Admins can create global challenges"
-- ON challenges FOR INSERT
-- WITH CHECK (scope = 'global' AND false); -- Prevent client-side creation

CREATE POLICY "Club owners and admins can create club challenges"
ON challenges FOR INSERT
WITH CHECK (
  scope = 'club' AND
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = challenges.club_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- 수정 정책
-- Note: Global challenges can only be updated via DB by developers
-- CREATE POLICY "Admins can update global challenges"
-- ON challenges FOR UPDATE
-- USING (scope = 'global' AND false);

CREATE POLICY "Club owners and admins can update club challenges"
ON challenges FOR UPDATE
USING (
  scope = 'club' AND
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = challenges.club_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- 삭제 정책
-- Note: Global challenges can only be deleted via DB by developers
-- CREATE POLICY "Admins can delete global challenges"
-- ON challenges FOR DELETE
-- USING (scope = 'global' AND false);

CREATE POLICY "Club owners and admins can delete club challenges"
ON challenges FOR DELETE
USING (
  scope = 'club' AND
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = challenges.club_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- Participants 정책
CREATE POLICY "Users can view their own participations"
ON challenge_participants FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can contribute to challenges"
ON challenge_participants FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own participations"
ON challenge_participants FOR DELETE
USING (user_id = auth.uid());

-- ============================================
-- 7. 코멘트
-- ============================================

COMMENT ON TABLE challenges IS 'Two-Track 챌린지 시스템: Global(앱 전체) + Club(클럽별)';
COMMENT ON COLUMN challenges.scope IS '범위: global(앱 전체) 또는 club(클럽 전용)';
COMMENT ON COLUMN challenges.club_id IS 'club 스코프일 때만 필수, global은 NULL';
COMMENT ON COLUMN challenges.goal_metric IS '측정 지표: total_workouts, total_volume, total_duration, total_distance';
COMMENT ON COLUMN challenges.meta_data IS '컨텍스트 데이터 (JSONB): season, tier, badge_url (global) / bet_mode, penalty, meme_image (club)';
COMMENT ON COLUMN challenges.origin_challenge_id IS '원본 챌린지 ID (포크된 경우)';

COMMENT ON TABLE challenge_participants IS '챌린지 참가 기록 및 기여 내역';

-- ============================================
-- 8. 샘플 글로벌 챌린지 데이터
-- ============================================

-- 웰컴 챌린지: 가입 후 3일 연속 출석
-- Note: created_by는 나중에 수동으로 업데이트하거나, 첫 번째 사용자 ID 사용
INSERT INTO challenges (
  scope, title, description, goal_metric, goal_value,
  start_date, end_date, status,
  meta_data, created_by
) VALUES (
  'global',
  '🎉 웰컴 챌린지: 작심삼일 타파!',
  '가입 후 3일 연속 운동 기록하기',
  'total_workouts',
  3,
  '2026-01-01',
  '2026-12-31',
  'active',
  '{"badge_url": "welcome_badge.png", "reward": "프로필 배지", "tier": "bronze"}'::jsonb,
  (SELECT id FROM users ORDER BY created_at LIMIT 1)
) ON CONFLICT DO NOTHING;

-- 시즌 챌린지: 2026 윈터 시즌
INSERT INTO challenges (
  scope, title, description, goal_metric, goal_value,
  start_date, end_date, status,
  meta_data, created_by
) VALUES (
  'global',
  '❄️ 2026 윈터 시즌: 설국열차',
  '1월 한 달간 총 볼륨 10톤 달성하기',
  'total_volume',
  10000,
  '2026-01-01',
  '2026-01-31',
  'active',
  '{"season": "2026-Winter", "badge_url": "winter_badge.png", "tier": "silver"}'::jsonb,
  (SELECT id FROM users ORDER BY created_at LIMIT 1)
) ON CONFLICT DO NOTHING;

-- ============================================
-- 9. 기존 테이블 처리 및 호환성 뷰 생성
-- ============================================

-- 기존 테이블이 있으면 DROP (데이터 마이그레이션 완료 후)
-- 주의: 프로덕션에서는 반드시 데이터 백업 후 진행하세요!
DROP TABLE IF EXISTS club_challenges CASCADE;
DROP TABLE IF EXISTS challenge_contributions CASCADE;

-- 호환성을 위한 뷰 생성
CREATE OR REPLACE VIEW club_challenges AS
SELECT
  id,
  club_id,
  title,
  description,
  goal_metric as challenge_type,
  goal_value as target_value,
  current_value,
  start_date,
  end_date,
  status,
  created_by,
  created_at,
  updated_at
FROM challenges
WHERE scope = 'club';

CREATE OR REPLACE VIEW challenge_contributions AS
SELECT * FROM challenge_participants;
