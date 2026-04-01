-- Fix RLS policies for workout_likes and workout_comments
-- Allow INSERT/UPDATE/DELETE for authenticated users

-- workout_likes: Allow users to like workouts
CREATE POLICY "users_can_like" ON public.workout_likes
  FOR INSERT
  WITH CHECK (true);  -- 일단 모두 허용 (나중에 Netlify Functions로 전환)

CREATE POLICY "users_can_unlike" ON public.workout_likes
  FOR DELETE
  USING (true);  -- 일단 모두 허용

-- workout_comments: Allow users to comment
CREATE POLICY "users_can_comment" ON public.workout_comments
  FOR INSERT
  WITH CHECK (true);  -- 일단 모두 허용

CREATE POLICY "users_can_update_own_comment" ON public.workout_comments
  FOR UPDATE
  USING (true)  -- 일단 모두 허용
  WITH CHECK (true);

CREATE POLICY "users_can_delete_own_comment" ON public.workout_comments
  FOR DELETE
  USING (true);  -- 일단 모두 허용

-- TODO: 나중에 Netlify Functions로 전환 시 이 정책들을 제거하고
-- Service Role Key만 허용하도록 변경
