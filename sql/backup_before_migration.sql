-- 마이그레이션 전 백업 스크립트
-- 실행일: 2026-03-30

-- 1. workout_types 테이블 전체 백업
CREATE TABLE IF NOT EXISTS workout_types_backup_20260330 AS
SELECT * FROM workout_types;

-- 2. 백업 확인
SELECT
  'workout_types 백업 완료' as status,
  COUNT(*) as total_rows
FROM workout_types_backup_20260330;

-- 3. sub_types 컬럼 데이터 확인 (롤백용)
SELECT
  id,
  name,
  sub_types,
  sub_type_mode
FROM workout_types
ORDER BY display_order;

-- ==========================================
-- 롤백 방법 (문제 발생 시):
-- ==========================================
--
-- -- 1단계: 기존 데이터 삭제
-- DELETE FROM workout_types;
--
-- -- 2단계: 백업에서 복원
-- INSERT INTO workout_types
-- SELECT * FROM workout_types_backup_20260330;
--
-- -- 3단계: 백업 테이블 삭제 (확인 후)
-- -- DROP TABLE workout_types_backup_20260330;
