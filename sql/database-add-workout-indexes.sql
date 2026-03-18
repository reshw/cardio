-- 성능 최적화 인덱스 추가

-- workout_comments 테이블: workout_id로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_workout_comments_workout_id
  ON workout_comments(workout_id);

-- workout_likes 테이블: workout_id로 빠른 조회
CREATE INDEX IF NOT EXISTS idx_workout_likes_workout_id
  ON workout_likes(workout_id);

-- 인덱스 생성 완료 확인
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('workout_comments', 'workout_likes')
ORDER BY tablename, indexname;
