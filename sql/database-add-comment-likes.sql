-- 댓글 좋아요 테이블 생성
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES workout_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 모든 사용자가 댓글 좋아요 조회 가능
CREATE POLICY "Anyone can view comment likes"
  ON comment_likes
  FOR SELECT
  USING (true);

-- RLS 정책: 사용자는 자신의 좋아요만 추가 가능
CREATE POLICY "Users can add their own comment likes"
  ON comment_likes
  FOR INSERT
  WITH CHECK (true);

-- RLS 정책: 사용자는 자신의 좋아요만 삭제 가능
CREATE POLICY "Users can delete their own comment likes"
  ON comment_likes
  FOR DELETE
  USING (true);

-- 테스트 쿼리: 특정 댓글의 좋아요 개수 조회
-- SELECT comment_id, COUNT(*) as like_count
-- FROM comment_likes
-- WHERE comment_id = 'YOUR_COMMENT_ID'
-- GROUP BY comment_id;
