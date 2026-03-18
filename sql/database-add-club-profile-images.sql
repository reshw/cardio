-- club_members 테이블에 클럽별 프로필 이미지 컬럼 추가

ALTER TABLE club_members ADD COLUMN IF NOT EXISTS club_profile_image TEXT;

-- club_profile_image: 클럽에서 사용할 프로필 이미지 URL
-- NULL인 경우: 사용자의 기본 profile_image 사용
-- 'default:{color}' 형식: 기본 생성된 아바타 (예: 'default:#ff5733')
-- 'https://...' 형식: Cloudinary 업로드 이미지 또는 Kakao 프로필 URL

-- 예시:
-- UPDATE club_members SET club_profile_image = 'default:#3b82f6' WHERE id = 'some-id';
-- UPDATE club_members SET club_profile_image = 'https://res.cloudinary.com/...' WHERE id = 'some-id';
