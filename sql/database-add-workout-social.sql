-- 운동 좋아요 테이블
CREATE TABLE IF NOT EXISTS workout_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workout_id, club_id, user_id)
);

-- 운동 댓글 테이블
CREATE TABLE IF NOT EXISTS workout_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES workout_comments(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_workout_likes_workout_club
  ON workout_likes(workout_id, club_id);
CREATE INDEX IF NOT EXISTS idx_workout_likes_user
  ON workout_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_workout_comments_workout_club
  ON workout_comments(workout_id, club_id);
CREATE INDEX IF NOT EXISTS idx_workout_comments_parent
  ON workout_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workout_comments_created
  ON workout_comments(created_at DESC);

-- RLS 비활성화 (개발 환경)
ALTER TABLE workout_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE workout_comments DISABLE ROW LEVEL SECURITY;
