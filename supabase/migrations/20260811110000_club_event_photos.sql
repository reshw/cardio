-- ============================================
-- 행사 갤러리: 행사 끝나고 참가 여부 상관없이 클럽원 누구나 사진 제출
-- 업로드는 기존 R2 파이프라인(/api/upload-to-r2, uploadToR2)을 그대로 쓰고
-- 이 테이블엔 결과 URL만 저장한다 — 새 스토리지 버킷 불필요.
-- ============================================

CREATE TABLE IF NOT EXISTS public.club_event_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_url  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_event_photos_event
  ON public.club_event_photos(event_id, created_at DESC);

ALTER TABLE public.club_event_photos ENABLE ROW LEVEL SECURITY;

-- is_club_event_member / is_club_event_manager 는 20260811070000 에서 정의됨.

DROP POLICY IF EXISTS "행사사진 클럽원 조회" ON public.club_event_photos;
DROP POLICY IF EXISTS "행사사진 클럽원 등록" ON public.club_event_photos;
DROP POLICY IF EXISTS "행사사진 본인 삭제" ON public.club_event_photos;
DROP POLICY IF EXISTS "행사사진 운영진 삭제" ON public.club_event_photos;

CREATE POLICY "행사사진 클럽원 조회"
  ON public.club_event_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_event_member(e.club_id)
    )
  );

-- 참가/체크인 여부와 무관하게 같은 클럽 멤버면 누구나 제출 가능 — 본인 이름으로만
CREATE POLICY "행사사진 클럽원 등록"
  ON public.club_event_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.app_user_id()
    AND EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_event_member(e.club_id)
    )
  );

CREATE POLICY "행사사진 본인 삭제"
  ON public.club_event_photos FOR DELETE
  TO authenticated
  USING (user_id = public.app_user_id());

CREATE POLICY "행사사진 운영진 삭제"
  ON public.club_event_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_events e
      WHERE e.id = event_id AND public.is_club_event_manager(e.club_id)
    )
  );
