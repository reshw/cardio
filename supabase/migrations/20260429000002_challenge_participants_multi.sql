-- 1인 1목표 → 1인 다종목 허용
ALTER TABLE public.challenge_participants
  DROP CONSTRAINT challenge_participants_challenge_id_user_id_key;

ALTER TABLE public.challenge_participants
  ADD CONSTRAINT challenge_participants_challenge_id_user_id_category_sub_type_key
  UNIQUE (challenge_id, user_id, category, sub_type);
