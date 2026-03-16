-- Fix Club RLS Policies
-- 클럽 생성 시 RLS 오류 해결

-- Enable RLS
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view public clubs or their own clubs" ON clubs;
DROP POLICY IF EXISTS "Users can insert their own clubs" ON clubs;
DROP POLICY IF EXISTS "Club owners can update their clubs" ON clubs;
DROP POLICY IF EXISTS "Club owners can delete their clubs" ON clubs;

DROP POLICY IF EXISTS "Members can view club memberships" ON club_members;
DROP POLICY IF EXISTS "Users can join clubs" ON club_members;
DROP POLICY IF EXISTS "Users can update their own role" ON club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON club_members;

-- Create Clubs Policies
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

-- Create Club Members Policies
CREATE POLICY "Members can view club memberships"
  ON club_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join clubs"
  ON club_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own role"
  ON club_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can leave clubs"
  ON club_members FOR DELETE
  USING (user_id = auth.uid());
