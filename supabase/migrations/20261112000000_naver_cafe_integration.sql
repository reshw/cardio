-- ============================================
-- 네이버 카페 자동 발행 연동
-- 클럽달력에 행사가 등록되면 같은 내용으로 연결된 네이버 카페 게시판에 글을 올린다.
-- 서버(api/naver-cafe.ts, service_role)만 읽고 쓴다 — 네이버 토큰이 들어있어서
-- 클라이언트용 RLS 정책은 일부러 하나도 만들지 않는다 (RLS ON + 정책 0개 = 클라이언트 접근 불가).
-- ============================================

CREATE TABLE IF NOT EXISTS public.club_naver_cafe (
  club_id               uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  cafe_id               text,             -- 네이버 카페 clubid (예: 31581338)
  menu_id               text,             -- 게시판 menuid (예: 1)
  board_url             text,             -- 클럽장이 붙여넣은 게시판 주소 원문
  auto_publish          boolean NOT NULL DEFAULT true,
  access_token          text,
  refresh_token         text,
  token_expires_at      timestamptz,
  naver_user_id         text,             -- 연동한 네이버 계정 식별자 (글 작성자)
  connected_by          uuid REFERENCES public.users(id),
  connected_at          timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_naver_cafe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_naver_cafe FROM anon, authenticated;

-- 행사별 발행 결과 (클라이언트도 읽음 — 행사 상세에 카페 글 링크 표시)
ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS naver_cafe_article_url  text,
  ADD COLUMN IF NOT EXISTS naver_cafe_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS naver_cafe_error        text;
