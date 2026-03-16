-- Voice Workout Log - Complete Database Schema
-- 전체 데이터베이스 스키마

-- ============================================
-- 1. Users Table (이미 존재한다면 SKIP)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Kakao login fields
  kakao_id TEXT UNIQUE,
  provider TEXT DEFAULT 'local',
  profile_image TEXT,
  phone_number TEXT,
  birthyear TEXT,
  gender TEXT,
  nickname TEXT
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- Comments
COMMENT ON TABLE users IS '사용자 정보';
COMMENT ON COLUMN users.kakao_id IS '카카오 사용자 고유 ID';
COMMENT ON COLUMN users.provider IS '로그인 제공자 (local, kakao)';
COMMENT ON COLUMN users.profile_image IS '프로필 이미지 URL';
COMMENT ON COLUMN users.phone_number IS '전화번호';
COMMENT ON COLUMN users.birthyear IS '출생년도';
COMMENT ON COLUMN users.gender IS '성별 (male, female)';
COMMENT ON COLUMN users.nickname IS '카카오 닉네임';

-- ============================================
-- 2. Workout Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  normalized_text TEXT,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for workout_logs table
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_date ON workout_logs(date);
CREATE INDEX IF NOT EXISTS idx_workout_logs_created_at ON workout_logs(created_at);

-- Comments
COMMENT ON TABLE workout_logs IS '운동 기록 로그';
COMMENT ON COLUMN workout_logs.user_id IS '사용자 ID';
COMMENT ON COLUMN workout_logs.date IS '운동 날짜 (YYYY-MM-DD)';
COMMENT ON COLUMN workout_logs.raw_text IS '사용자가 입력한 원본 텍스트';
COMMENT ON COLUMN workout_logs.normalized_text IS '정규화된 텍스트';
COMMENT ON COLUMN workout_logs.memo IS '메모';

-- ============================================
-- 3. Workouts Table
-- ============================================
CREATE TABLE IF NOT EXISTS workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  weight_kg NUMERIC,
  duration_min INTEGER,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for workouts table
CREATE INDEX IF NOT EXISTS idx_workouts_log_id ON workouts(workout_log_id);
CREATE INDEX IF NOT EXISTS idx_workouts_name ON workouts(name);
CREATE INDEX IF NOT EXISTS idx_workouts_type ON workouts(type);

-- Comments
COMMENT ON TABLE workouts IS '개별 운동 상세 정보';
COMMENT ON COLUMN workouts.workout_log_id IS '운동 기록 로그 ID';
COMMENT ON COLUMN workouts.name IS '운동 이름';
COMMENT ON COLUMN workouts.type IS '운동 타입';
COMMENT ON COLUMN workouts.sets IS '세트 수';
COMMENT ON COLUMN workouts.reps IS '반복 횟수';
COMMENT ON COLUMN workouts.weight_kg IS '무게 (kg)';
COMMENT ON COLUMN workouts.duration_min IS '운동 시간 (분)';
COMMENT ON COLUMN workouts.note IS '운동 메모';

-- ============================================
-- 4. User Profiles Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goals TEXT NOT NULL,
  raw_input TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for user_profiles table
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Comments
COMMENT ON TABLE user_profiles IS '사용자 운동 목표 프로필';
COMMENT ON COLUMN user_profiles.user_id IS '사용자 ID';
COMMENT ON COLUMN user_profiles.goals IS '운동 목표';
COMMENT ON COLUMN user_profiles.raw_input IS '사용자 원본 입력';

-- ============================================
-- 5. Triggers for auto-updating timestamps
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for workout_logs table
DROP TRIGGER IF EXISTS update_workout_logs_updated_at ON workout_logs;
CREATE TRIGGER update_workout_logs_updated_at
  BEFORE UPDATE ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_profiles table
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Workout Logs Policies
CREATE POLICY "Users can view their own workout logs"
  ON workout_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own workout logs"
  ON workout_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own workout logs"
  ON workout_logs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own workout logs"
  ON workout_logs FOR DELETE
  USING (user_id = auth.uid());

-- Workouts Policies
CREATE POLICY "Users can view their own workouts"
  ON workouts FOR SELECT
  USING (workout_log_id IN (
    SELECT id FROM workout_logs WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own workouts"
  ON workouts FOR INSERT
  WITH CHECK (workout_log_id IN (
    SELECT id FROM workout_logs WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own workouts"
  ON workouts FOR UPDATE
  USING (workout_log_id IN (
    SELECT id FROM workout_logs WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own workouts"
  ON workouts FOR DELETE
  USING (workout_log_id IN (
    SELECT id FROM workout_logs WHERE user_id = auth.uid()
  ));

-- User Profiles Policies
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own profile"
  ON user_profiles FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 7. Clubs System Tables (Phase 1)
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

-- Comments
COMMENT ON TABLE clubs IS '클럽 (운동 그룹)';
COMMENT ON COLUMN clubs.name IS '클럽 이름';
COMMENT ON COLUMN clubs.description IS '클럽 설명';
COMMENT ON COLUMN clubs.is_public IS '공개 클럽 여부 (true: 검색 가능, false: 초대 링크만)';
COMMENT ON COLUMN clubs.invite_code IS '초대 링크용 UUID (예: /join/{invite_code})';
COMMENT ON COLUMN clubs.owner_id IS '클럽 소유자 ID';

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

-- Comments
COMMENT ON TABLE club_members IS '클럽 멤버십';
COMMENT ON COLUMN club_members.club_id IS '클럽 ID';
COMMENT ON COLUMN club_members.user_id IS '사용자 ID';
COMMENT ON COLUMN club_members.role IS '역할 (owner: 소유자, admin: 관리자, member: 일반 멤버)';

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

-- Comments
COMMENT ON TABLE club_feeds IS '클럽에 공유된 운동 기록 피드';
COMMENT ON COLUMN club_feeds.club_id IS '클럽 ID';
COMMENT ON COLUMN club_feeds.user_id IS '공유한 사용자 ID';
COMMENT ON COLUMN club_feeds.workout_log_id IS '공유된 운동 기록 ID';

-- ============================================
-- 8. Challenges System Tables (Phase 2)
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

-- Comments
COMMENT ON TABLE club_challenges IS '클럽 합산 챌린지 (보스 레이드 컨셉)';
COMMENT ON COLUMN club_challenges.club_id IS '클럽 ID';
COMMENT ON COLUMN club_challenges.title IS '챌린지 제목';
COMMENT ON COLUMN club_challenges.challenge_type IS '챌린지 타입 (total_workouts: 총 운동 수, total_volume: 총 볼륨, total_duration: 총 시간, total_distance: 총 거리)';
COMMENT ON COLUMN club_challenges.target_value IS '목표 값 (예: 1000회, 50000kg, 3000분)';
COMMENT ON COLUMN club_challenges.current_value IS '현재 달성 값';
COMMENT ON COLUMN club_challenges.start_date IS '시작일 (YYYY-MM-DD)';
COMMENT ON COLUMN club_challenges.end_date IS '종료일 (YYYY-MM-DD)';
COMMENT ON COLUMN club_challenges.status IS '상태 (active: 진행 중, completed: 완료, failed: 실패)';

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

-- Comments
COMMENT ON TABLE challenge_contributions IS '챌린지에 대한 개별 기여 (운동 기록)';
COMMENT ON COLUMN challenge_contributions.challenge_id IS '챌린지 ID';
COMMENT ON COLUMN challenge_contributions.user_id IS '기여한 사용자 ID';
COMMENT ON COLUMN challenge_contributions.workout_log_id IS '기여한 운동 기록 ID';
COMMENT ON COLUMN challenge_contributions.contribution_value IS '기여 값 (운동 수, 볼륨, 시간, 거리 등)';

-- ============================================
-- 9. Triggers for Clubs System
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
-- 10. Row Level Security (RLS) Policies for Clubs
-- ============================================

-- Enable RLS on clubs tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_contributions ENABLE ROW LEVEL SECURITY;

-- Clubs Policies
CREATE POLICY "Users can view public clubs or their own clubs"
  ON clubs FOR SELECT
  USING (is_public = true OR id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own clubs"
  ON clubs FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Club owners can update their clubs"
  ON clubs FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Club owners can delete their clubs"
  ON clubs FOR DELETE
  USING (owner_id = auth.uid());

-- Club Members Policies
CREATE POLICY "Members can view their club memberships"
  ON club_members FOR SELECT
  USING (user_id = auth.uid() OR club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can join clubs"
  ON club_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners and admins can update memberships"
  ON club_members FOR UPDATE
  USING (club_id IN (
    SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Owners and admins can delete memberships"
  ON club_members FOR DELETE
  USING (club_id IN (
    SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Club Feeds Policies
CREATE POLICY "Members can view club feeds"
  ON club_feeds FOR SELECT
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can share to club feeds"
  ON club_feeds FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own feeds"
  ON club_feeds FOR DELETE
  USING (user_id = auth.uid());

-- Club Challenges Policies
CREATE POLICY "Members can view club challenges"
  ON club_challenges FOR SELECT
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

CREATE POLICY "Owners and admins can create challenges"
  ON club_challenges FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Owners and admins can update challenges"
  ON club_challenges FOR UPDATE
  USING (club_id IN (
    SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Owners and admins can delete challenges"
  ON club_challenges FOR DELETE
  USING (club_id IN (
    SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Challenge Contributions Policies
CREATE POLICY "Members can view contributions"
  ON challenge_contributions FOR SELECT
  USING (challenge_id IN (
    SELECT id FROM club_challenges WHERE club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Members can contribute"
  ON challenge_contributions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their contributions"
  ON challenge_contributions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 11. Helper Functions
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

-- ============================================
-- 12. Sample Data (Optional)
-- ============================================

-- Insert test user (카카오 로그인 후 이 사용자는 삭제 가능)
-- INSERT INTO users (username, display_name, email, provider)
-- VALUES ('tester01', '테스터', 'test@example.com', 'local')
-- ON CONFLICT (username) DO NOTHING;
