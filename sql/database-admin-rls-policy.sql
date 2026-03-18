-- 어드민을 위한 RLS 정책 추가

-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Admins can view all clubs" ON clubs;
DROP POLICY IF EXISTS "Admins can update club status" ON clubs;

-- 1. 어드민은 모든 클럽 조회 가능 (status 무관)
CREATE POLICY "Admins can view all clubs"
ON clubs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = TRUE
  )
);

-- 2. 어드민은 클럽 상태 업데이트 가능 (승인/거부)
CREATE POLICY "Admins can update club status"
ON clubs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = TRUE
  )
);

-- 확인
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'clubs'
ORDER BY policyname;
