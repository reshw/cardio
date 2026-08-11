-- 폰 푸시(FCM)만 끄는 사용자별 뮤트. 알림센터(notifications 목록)는 그대로 쌓인다 —
-- notification-inserted 웹훅이 발송 직전에만 이 플래그를 확인해서 스킵한다.
-- (and 요청, cardio-comms #71)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_muted BOOLEAN NOT NULL DEFAULT false;
