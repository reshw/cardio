-- ============================================
-- 챌린지 "직접 참여 신청" 막기 옵션
-- 게시판 댓글 등 앱 밖 채널로 목표를 접수하고,
-- 관리자가 challenge_participants 에 수동으로 입력하는 방식의
-- 챌린지를 지원하기 위한 플래그.
-- 켜져 있으면 UI에서 참여/종목추가 버튼 대신 안내 문구를 보여준다.
-- ============================================

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS join_disabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS join_disabled_message text;

COMMENT ON COLUMN public.challenges.join_disabled IS
  'true면 앱 내 참여 신청(ChallengeJoinModal) 버튼을 막고 join_disabled_message 안내문을 대신 표시. 참여자는 관리자가 수동으로 challenge_participants에 입력.';

COMMENT ON COLUMN public.challenges.join_disabled_message IS
  'join_disabled=true일 때 참여 버튼 자리에 표시할 안내 문구 (예: "참여 신청은 게시판 댓글로 받고 있어요").';
