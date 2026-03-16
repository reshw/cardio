-- Disable RLS for Development
-- 앱이 Supabase Auth를 사용하지 않으므로 RLS를 임시로 비활성화합니다.
-- 주의: 프로덕션에서는 반드시 Supabase Auth를 구현하고 RLS를 활성화해야 합니다!

-- Club 관련 테이블 RLS 비활성화
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_feeds DISABLE ROW LEVEL SECURITY;

-- Challenge 관련 테이블 RLS 비활성화
ALTER TABLE challenges DISABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants DISABLE ROW LEVEL SECURITY;

-- 기존 정책 모두 제거 (정리)
DROP POLICY IF EXISTS "Users can view public clubs or their own clubs" ON clubs;
DROP POLICY IF EXISTS "Users can insert their own clubs" ON clubs;
DROP POLICY IF EXISTS "Club owners can update their clubs" ON clubs;
DROP POLICY IF EXISTS "Club owners can delete their clubs" ON clubs;

DROP POLICY IF EXISTS "Members can view club memberships" ON club_members;
DROP POLICY IF EXISTS "Users can join clubs" ON club_members;
DROP POLICY IF EXISTS "Users can update their own role" ON club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON club_members;

DROP POLICY IF EXISTS "Members can view club feeds" ON club_feeds;
DROP POLICY IF EXISTS "Members can share to club feeds" ON club_feeds;
DROP POLICY IF EXISTS "Users can delete their own feeds" ON club_feeds;

DROP POLICY IF EXISTS "Anyone can view global challenges" ON challenges;
DROP POLICY IF EXISTS "Club members can view club challenges" ON challenges;
DROP POLICY IF EXISTS "Club owners and admins can create club challenges" ON challenges;
DROP POLICY IF EXISTS "Club owners and admins can update club challenges" ON challenges;
DROP POLICY IF EXISTS "Club owners and admins can delete club challenges" ON challenges;

DROP POLICY IF EXISTS "Users can view their own participations" ON challenge_participants;
DROP POLICY IF EXISTS "Users can contribute to challenges" ON challenge_participants;
DROP POLICY IF EXISTS "Users can delete their own participations" ON challenge_participants;

-- 확인
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('clubs', 'club_members', 'club_feeds', 'challenges', 'challenge_participants');
