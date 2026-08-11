-- ============================================
-- 클럽 달력: 행사 등록 폼 상세 필드 확장
-- 짐보관/GPX/난이도/설명은 선택 입력 — 값이 없으면 상세보기에서 그 줄을 숨긴다.
-- location 컬럼은 기존 그대로 재사용 (의미만 "집결장소"로 통일, 컬럼명 변경 없음).
-- ============================================

ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS baggage_info text,  -- 짐보관 (선택)
  ADD COLUMN IF NOT EXISTS course        text,  -- 코스
  ADD COLUMN IF NOT EXISTS gpx_url       text,  -- GPX 링크 또는 업로드 파일의 공개 URL (선택)
  ADD COLUMN IF NOT EXISTS gear_info     text,  -- 준비물(장비)
  ADD COLUMN IF NOT EXISTS difficulty    text;  -- 난이도 (선택)

-- ============================================
-- GPX 파일 업로드용 스토리지 버킷
-- 파일 자체는 민감정보가 아니라 읽기는 public, 쓰기는 로그인 사용자로만 제한.
-- 실제 업로드 UI는 클럽 운영진에게만 노출되지만(CreateEventSheet), RLS 레벨에서
-- 클럽별 권한까지 매핑하려면 storage 경로 파싱이 필요해 과설계라 authenticated로 단순화.
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('club-event-gpx', 'club-event-gpx', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "GPX 업로드" ON storage.objects;
DROP POLICY IF EXISTS "GPX 공개 읽기" ON storage.objects;
DROP POLICY IF EXISTS "GPX 본인 삭제" ON storage.objects;

CREATE POLICY "GPX 업로드"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'club-event-gpx');

CREATE POLICY "GPX 공개 읽기"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'club-event-gpx');

CREATE POLICY "GPX 본인 삭제"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'club-event-gpx' AND owner = auth.uid());
