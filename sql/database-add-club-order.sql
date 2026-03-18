-- Add display_order column to club_members
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Set initial order based on join date
UPDATE club_members
SET display_order = (
  SELECT COUNT(*)
  FROM club_members cm2
  WHERE cm2.user_id = club_members.user_id
    AND cm2.joined_at < club_members.joined_at
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_club_members_user_order ON club_members(user_id, display_order);
