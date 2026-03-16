-- Club System Migration (RLS 비활성화 버전)
-- 프로토타입 단계에서는 RLS를 비활성화하고 애플리케이션 레벨에서 권한 관리

-- ============================================
-- 1. Helper Function (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Clubs System Tables (Phase 1)
-- ============================================

-- Clubs Table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  invite_code UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for clubs table
CREATE INDEX IF NOT EXISTS idx_clubs_owner_id ON clubs(owner_id);
CREATE INDEX IF NOT EXISTS idx_clubs_invite_code ON clubs(invite_code);
CREATE INDEX IF NOT EXISTS idx_clubs_is_public ON clubs(is_public) WHERE is_public = true;

-- Club Members Table (N:M relationship)
CREATE TABLE IF NOT EXISTS club_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Indexes for club_members table
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_role ON club_members(role);

-- Club Feeds Table (shared workout logs)
CREATE TABLE IF NOT EXISTS club_feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, workout_log_id)
);

-- Indexes for club_feeds table
CREATE INDEX IF NOT EXISTS idx_club_feeds_club_id ON club_feeds(club_id);
CREATE INDEX IF NOT EXISTS idx_club_feeds_user_id ON club_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_club_feeds_workout_log_id ON club_feeds(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_club_feeds_shared_at ON club_feeds(shared_at DESC);

-- ============================================
-- 3. Challenges System Tables (Phase 2)
-- ============================================

-- Club Challenges Table
CREATE TABLE IF NOT EXISTS club_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL DEFAULT 'total_workouts' CHECK (
    challenge_type IN ('total_workouts', 'total_volume', 'total_duration', 'total_distance')
  ),
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for club_challenges table
CREATE INDEX IF NOT EXISTS idx_club_challenges_club_id ON club_challenges(club_id);
CREATE INDEX IF NOT EXISTS idx_club_challenges_status ON club_challenges(status);
CREATE INDEX IF NOT EXISTS idx_club_challenges_end_date ON club_challenges(end_date);

-- Challenge Contributions Table
CREATE TABLE IF NOT EXISTS challenge_contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES club_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  contribution_value INTEGER NOT NULL,
  contributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(challenge_id, workout_log_id)
);

-- Indexes for challenge_contributions table
CREATE INDEX IF NOT EXISTS idx_challenge_contributions_challenge_id ON challenge_contributions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_contributions_user_id ON challenge_contributions(user_id);

-- ============================================
-- 4. Triggers for Clubs System
-- ============================================

-- Trigger for clubs table
DROP TRIGGER IF EXISTS update_clubs_updated_at ON clubs;
CREATE TRIGGER update_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for club_challenges table
DROP TRIGGER IF EXISTS update_club_challenges_updated_at ON club_challenges;
CREATE TRIGGER update_club_challenges_updated_at
  BEFORE UPDATE ON club_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. RLS 비활성화 (프로토타입 단계)
-- ============================================

-- 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Users can view public clubs or their own clubs" ON clubs;
DROP POLICY IF EXISTS "Users can insert their own clubs" ON clubs;
DROP POLICY IF EXISTS "Club owners can update their clubs" ON clubs;
DROP POLICY IF EXISTS "Club owners can delete their clubs" ON clubs;

DROP POLICY IF EXISTS "Members can view club memberships" ON club_members;
DROP POLICY IF EXISTS "Members can view their club memberships" ON club_members;
DROP POLICY IF EXISTS "Users can join clubs" ON club_members;
DROP POLICY IF EXISTS "Owners and admins can update memberships" ON club_members;
DROP POLICY IF EXISTS "Users can update their own role" ON club_members;
DROP POLICY IF EXISTS "Owners and admins can delete memberships" ON club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON club_members;

DROP POLICY IF EXISTS "Members can view club feeds" ON club_feeds;
DROP POLICY IF EXISTS "Members can share to club feeds" ON club_feeds;
DROP POLICY IF EXISTS "Users can delete their own feeds" ON club_feeds;

DROP POLICY IF EXISTS "Members can view club challenges" ON club_challenges;
DROP POLICY IF EXISTS "Owners and admins can create challenges" ON club_challenges;
DROP POLICY IF EXISTS "Owners and admins can update challenges" ON club_challenges;
DROP POLICY IF EXISTS "Owners and admins can delete challenges" ON club_challenges;

DROP POLICY IF EXISTS "Members can view contributions" ON challenge_contributions;
DROP POLICY IF EXISTS "Members can contribute" ON challenge_contributions;
DROP POLICY IF EXISTS "Users can delete their contributions" ON challenge_contributions;

-- RLS 비활성화
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_feeds DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_contributions DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function to increment challenge current_value
CREATE OR REPLACE FUNCTION increment_challenge_value(
  p_challenge_id UUID,
  p_increment INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE club_challenges
  SET current_value = current_value + p_increment,
      updated_at = NOW()
  WHERE id = p_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
