-- 카디오 랩드 노출 기간 (클럽별, 운영진 설정)
--   NULL                                        → 기본 11/1 ~ 1/31
--   {"mode":"off"}                              → 표시 안 함
--   {"mode":"custom","from":"YYYY-MM-DD","to":"YYYY-MM-DD"} → 지정 기간
-- 해석 규칙은 웹 src/utils/wrappedPeriod.ts
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS wrapped_period jsonb;

COMMENT ON COLUMN public.clubs.wrapped_period IS
  '카디오 랩드 배너 노출 기간. NULL=기본(11/1~1/31), {"mode":"off"}, {"mode":"custom","from","to"}';
