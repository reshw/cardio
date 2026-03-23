-- club_members 테이블의 role을 manager/vice-manager/member로 변경

-- 0단계: 현재 role 값 확인 (실행해서 어떤 값들이 있는지 확인)
-- SELECT DISTINCT role FROM club_members;

-- 1단계: 기존 constraint 제거
ALTER TABLE club_members
DROP CONSTRAINT IF EXISTS club_members_role_check;

-- 2단계: 모든 role 값 정리
-- 'admin' -> 'manager'로 변경
UPDATE club_members
SET role = 'manager'
WHERE role = 'admin';

-- 혹시 다른 값이 있다면 'member'로 통일
UPDATE club_members
SET role = 'member'
WHERE role NOT IN ('manager', 'vice-manager', 'member');

-- 3단계: 새로운 constraint 추가 (manager/vice-manager/member)
ALTER TABLE club_members
ADD CONSTRAINT club_members_role_check
CHECK (role IN ('manager', 'vice-manager', 'member'));
