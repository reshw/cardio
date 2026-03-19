-- ============================================
-- 테스트용 더미 데이터 생성 (50명의 유저)
-- ============================================
-- 목적: 마일리지 랭킹 UI 테스트를 위한 대량 데이터 생성
-- 클럽 ID: c71fcfd9-35a7-4fb7-a5d3-1885e0e9df45
-- ============================================

-- Step 1: users 테이블에 is_tester 컬럼 추가 (없으면)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_tester BOOLEAN DEFAULT FALSE;

-- Step 2: 50명의 테스트 유저 생성
DO $$
DECLARE
  v_club_id UUID := 'c71fcfd9-35a7-4fb7-a5d3-1885e0e9df45';
  v_user_id UUID;
  v_distance NUMERIC;
  v_mileage NUMERIC;
  v_created_at TIMESTAMP WITH TIME ZONE;
  v_email TEXT;
  v_display_name TEXT;
BEGIN
  -- 현재 월의 시작일과 종료일 계산
  v_created_at := DATE_TRUNC('month', NOW());

  -- 50명의 유저 생성 및 데이터 입력
  FOR i IN 1..50 LOOP
    -- 유저 정보 설정
    v_email := 'tester' || i || '@test.cardio.app';
    v_display_name := '테스터' || i || '호';
    v_distance := i; -- 1km, 2km, ..., 50km
    v_mileage := i / 1.0; -- 러닝 마일리지 계수 1 (1km당 1 마일리지)

    -- 유저가 이미 존재하는지 확인
    SELECT id INTO v_user_id FROM users WHERE email = v_email;

    -- 존재하지 않으면 생성
    IF v_user_id IS NULL THEN
      INSERT INTO users (
        email,
        display_name,
        is_tester,
        created_at
      )
      VALUES (
        v_email,
        v_display_name,
        TRUE,
        NOW()
      )
      RETURNING id INTO v_user_id;
    ELSE
      -- 이미 존재하면 is_tester 플래그만 업데이트
      UPDATE users
      SET is_tester = TRUE
      WHERE id = v_user_id;
    END IF;

    -- 클럽 가입 (이미 가입되어 있으면 스킵)
    IF NOT EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = v_club_id AND user_id = v_user_id
    ) THEN
      INSERT INTO club_members (
        club_id,
        user_id,
        role,
        club_nickname,
        show_in_feed,
        show_mileage,
        joined_at
      )
      VALUES (
        v_club_id,
        v_user_id,
        'member',
        '테스터' || i,
        TRUE,
        TRUE,
        NOW()
      );
    END IF;

    -- 운동 기록 생성 (현재 월 기준, 랜덤 날짜)
    INSERT INTO workouts (
      user_id,
      category,
      sub_type,
      value,
      mileage,
      created_at,
      notes
    )
    VALUES (
      v_user_id,
      '달리기',
      '러닝',
      v_distance,
      v_mileage,
      v_created_at + (INTERVAL '1 day' * (i % 28)), -- 월 내 랜덤 날짜
      '테스트 데이터 - ' || v_distance || 'km 러닝'
    );

    RAISE NOTICE '테스터 % 생성 완료 (%.0f km, %.1f 마일리지)', i, v_distance, v_mileage;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '총 50명의 테스트 유저 생성 완료!';
  RAISE NOTICE '클럽 ID: %', v_club_id;
  RAISE NOTICE '========================================';
END $$;

-- Step 3: 생성된 데이터 확인
SELECT
  '생성된 테스트 유저 수' AS 항목,
  COUNT(*) AS 개수
FROM users
WHERE is_tester = TRUE;

SELECT
  '클럽 가입된 테스터 수' AS 항목,
  COUNT(*) AS 개수
FROM club_members
WHERE club_id = 'c71fcfd9-35a7-4fb7-a5d3-1885e0e9df45'
AND user_id IN (SELECT id FROM users WHERE is_tester = TRUE);

SELECT
  '생성된 운동 기록 수' AS 항목,
  COUNT(*) AS 개수
FROM workouts
WHERE user_id IN (SELECT id FROM users WHERE is_tester = TRUE);
