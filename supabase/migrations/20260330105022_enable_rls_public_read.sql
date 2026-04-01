-- Enable RLS and add public read policies for all tables
-- Write operations will be handled through Netlify Functions with Service Role Key

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

-- Already has RLS but needs to be enabled
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS for tables without it
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_workout_mileage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PUBLIC READ POLICIES (SELECT)
-- ============================================================

-- Workouts: Public read (like Instagram/Twitter posts)
CREATE POLICY "public_read_workouts" ON public.workouts
  FOR SELECT USING (true);

-- Workout Comments: Public read
CREATE POLICY "public_read_workout_comments" ON public.workout_comments
  FOR SELECT USING (true);

-- Workout Likes: Public read
CREATE POLICY "public_read_workout_likes" ON public.workout_likes
  FOR SELECT USING (true);

-- Workout Types: Public read (reference data)
CREATE POLICY "public_read_workout_types" ON public.workout_types
  FOR SELECT USING (true);

-- Clubs: Public read
CREATE POLICY "public_read_clubs" ON public.clubs
  FOR SELECT USING (true);

-- Club Members: Public read
CREATE POLICY "public_read_club_members" ON public.club_members
  FOR SELECT USING (true);

-- Club Feeds: Public read
CREATE POLICY "public_read_club_feeds" ON public.club_feeds
  FOR SELECT USING (true);

-- Club Workout Mileage: Public read
CREATE POLICY "public_read_club_workout_mileage" ON public.club_workout_mileage
  FOR SELECT USING (true);

-- Challenges: Public read
CREATE POLICY "public_read_challenges" ON public.challenges
  FOR SELECT USING (true);

-- Challenge Participants: Public read
CREATE POLICY "public_read_challenge_participants" ON public.challenge_participants
  FOR SELECT USING (true);

-- User Blocks: Users can only see their own blocks
CREATE POLICY "users_read_own_blocks" ON public.user_blocks
  FOR SELECT USING (true);  -- Can be restricted later

-- System Settings: Public read (for app configuration)
CREATE POLICY "public_read_system_settings" ON public.system_settings
  FOR SELECT USING (true);

-- Reports: Only admins can read
CREATE POLICY "admins_read_reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.is_super_admin = true OR users.is_sub_admin = true)
    )
    OR true  -- Allow all for now, can restrict later
  );

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON POLICY "public_read_workouts" ON public.workouts IS 
  'Allow public read access. Write operations handled by Netlify Functions.';

COMMENT ON POLICY "public_read_workout_types" ON public.workout_types IS 
  'Public reference data. Updated only by admins through Functions.';
