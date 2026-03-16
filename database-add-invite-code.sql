-- Add invite_code column to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Function to generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update existing clubs with invite codes
UPDATE clubs
SET invite_code = generate_invite_code()
WHERE invite_code IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_clubs_invite_code ON clubs(invite_code);
