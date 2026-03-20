-- Drop existing tables if needed (optional - uncomment if you want fresh start)
-- DROP TABLE IF EXISTS club_members CASCADE;
-- DROP TABLE IF EXISTS clubs CASCADE;

-- Clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mileage_config JSONB DEFAULT '{
    "달리기-트레드밀": 1,
    "달리기-러닝": 1,
    "사이클-실외": 3,
    "사이클-실내": 5,
    "수영": 200,
    "계단": 20,
    "복싱-샌드백/미트": 1.78,
    "복싱-스파링": 0.77,
    "요가-일반": 3.27,
    "요가-빈야사/아쉬탕가": 2.45
  }'::jsonb
);

-- Club members table
CREATE TABLE IF NOT EXISTS club_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Add mileage column to workouts
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS mileage DECIMAL(10, 2) DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clubs_created_by ON clubs(created_by);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_mileage ON workouts(mileage);

-- Disable RLS for development
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_members DISABLE ROW LEVEL SECURITY;

-- Function to calculate mileage
CREATE OR REPLACE FUNCTION calculate_mileage(
  p_category TEXT,
  p_sub_type TEXT,
  p_value DECIMAL,
  p_unit TEXT
) RETURNS DECIMAL AS $$
DECLARE
  v_key TEXT;
  v_coefficient DECIMAL;
BEGIN
  -- Create key for mileage config lookup
  IF p_sub_type IS NOT NULL THEN
    v_key := p_category || '-' || p_sub_type;
  ELSE
    v_key := p_category;
  END IF;

  -- Default coefficients
  CASE v_key
    WHEN '달리기-트레드밀' THEN v_coefficient := 1;
    WHEN '달리기-러닝' THEN v_coefficient := 1;
    WHEN '사이클-실외' THEN v_coefficient := 0.333;
    WHEN '사이클-실내' THEN v_coefficient := 0.2;
    WHEN '수영' THEN v_coefficient := 0.005;
    WHEN '계단' THEN v_coefficient := 0.05;
    ELSE v_coefficient := 1;
  END CASE;

  RETURN p_value * v_coefficient;
END;
$$ LANGUAGE plpgsql;

-- Update existing workouts with mileage
UPDATE workouts
SET mileage = calculate_mileage(category, sub_type, value, unit)
WHERE mileage = 0 OR mileage IS NULL;
