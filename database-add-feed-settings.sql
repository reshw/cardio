-- club_members 테이블에 개인 설정 컬럼 추가
ALTER TABLE club_members
ADD COLUMN IF NOT EXISTS show_in_feed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_mileage BOOLEAN DEFAULT true;

COMMENT ON COLUMN club_members.show_in_feed IS '피드에 내 운동 기록 표시 여부';
COMMENT ON COLUMN club_members.show_mileage IS '랭킹에 내 마일리지 포함 여부';
