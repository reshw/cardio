-- tester11~tester30 사용자에게 테스트 운동 기록 추가
-- 각 사용자당 1개씩, 총 20개 레코드 삽입
-- 값: 1000km ~ 1019km
-- 시간: 2026-03-31 22:30:00

WITH target_users AS (
  SELECT
    id,
    username,
    ROW_NUMBER() OVER (ORDER BY username) - 1 as row_num
  FROM users
  WHERE username IN (
    'tester11', 'tester12', 'tester13', 'tester14', 'tester15',
    'tester16', 'tester17', 'tester18', 'tester19', 'tester20',
    'tester21', 'tester22', 'tester23', 'tester24', 'tester25',
    'tester26', 'tester27', 'tester28', 'tester29', 'tester30'
  )
)
INSERT INTO workouts (
  id,
  user_id,
  category,
  sub_type,
  value,
  unit,
  proof_image,
  created_at,
  intensity,
  sub_type_ratios,
  workout_time
)
SELECT
  gen_random_uuid(),
  id,
  '달리기',
  '러닝',
  1000 + row_num::numeric,  -- 1000, 1001, 1002, ..., 1019
  'km',
  null,
  '2026-03-31 22:30:00+09'::timestamptz,  -- KST (한국 시간)
  4,
  null,
  '2026-03-31 22:30:00+09'::timestamptz  -- KST (한국 시간)
FROM target_users;
