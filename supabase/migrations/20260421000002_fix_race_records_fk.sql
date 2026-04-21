-- race_records의 FK가 auth.users를 참조하는데, 이 앱은 public.users를 사용
-- FK를 public.users로 교체
ALTER TABLE race_records DROP CONSTRAINT IF EXISTS race_records_user_id_fkey;
ALTER TABLE race_records ADD CONSTRAINT race_records_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
