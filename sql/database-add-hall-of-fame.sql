-- Hall of Fame table creation
-- 3회 연속 마일리지 1등 등 특별한 업적을 달성한 멤버를 기리기 위한 기능

CREATE TABLE IF NOT EXISTS hall_of_fame (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inducted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  inducted_by UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_hof_club_id ON hall_of_fame(club_id);
CREATE INDEX IF NOT EXISTS idx_hof_user_id ON hall_of_fame(user_id);
CREATE INDEX IF NOT EXISTS idx_hof_club_user ON hall_of_fame(club_id, user_id);

-- Add comments
COMMENT ON TABLE hall_of_fame IS 'Hall of Fame members by club';
COMMENT ON COLUMN hall_of_fame.club_id IS 'Club ID';
COMMENT ON COLUMN hall_of_fame.user_id IS 'User ID inducted to Hall of Fame';
COMMENT ON COLUMN hall_of_fame.inducted_at IS 'Induction timestamp';
COMMENT ON COLUMN hall_of_fame.inducted_by IS 'Admin user ID who inducted';
COMMENT ON COLUMN hall_of_fame.reason IS 'Reason for induction (optional)';

-- Enable RLS
ALTER TABLE hall_of_fame ENABLE ROW LEVEL SECURITY;

-- Allow all users to view
CREATE POLICY "hall_of_fame_select_policy" ON hall_of_fame
  FOR SELECT USING (true);

-- Allow insert (will add admin check later)
CREATE POLICY "hall_of_fame_insert_policy" ON hall_of_fame
  FOR INSERT WITH CHECK (true);

-- Allow delete (will add admin check later)
CREATE POLICY "hall_of_fame_delete_policy" ON hall_of_fame
  FOR DELETE USING (true);
