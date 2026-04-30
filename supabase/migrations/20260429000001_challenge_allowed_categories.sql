-- challenges 테이블에 허용 종목 컬럼 추가
-- null이면 전체 허용, 배열이면 해당 카테고리만 허용
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS allowed_categories text[];
