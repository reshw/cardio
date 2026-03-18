-- Drop existing table
DROP TABLE IF EXISTS workouts CASCADE;

-- Create workouts table
CREATE TABLE workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  sub_type TEXT,
  value DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  proof_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_workouts_user_id ON workouts(user_id);
CREATE INDEX idx_workouts_created_at ON workouts(created_at DESC);
CREATE INDEX idx_workouts_category ON workouts(category);

-- Disable RLS for development
ALTER TABLE workouts DISABLE ROW LEVEL SECURITY;
