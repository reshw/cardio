-- ============================================================================
-- club_awards — 클럽 월별 시상 이력
--
-- 목적: 클럽이 마일리지 기준으로 매달 시상을 하는데 그 이력이 어디에도 안 남는다.
-- "지난달 1등은 이번달 1등해도 시상 대상이 아니다" 같은 규칙을 세우려면 먼저
-- 누가 언제 받았는지가 데이터로 있어야 한다. 이번 범위는 기록·조회까지고
-- 제외 규칙(쿨다운) 자체는 넣지 않는다 — 정책이 바뀌어도 데이터는 그대로 쓴다.
--
-- 상 종류를 컬럼으로 고정하지 않은 이유: 클럽마다 시상 체계가 다르다.
-- award_type enum 을 두면 클럽이 상을 하나 추가할 때마다 마이그레이션이 필요해진다.
-- 대신 tags(키워드 배열)로 두고 GIN 인덱스를 걸어 나중에 필터링이 되게 한다.
--   예: tags = '["마일리지", "1등"]'  →  WHERE tags @> '["1등"]'
--
-- ⚠️ 한계: 키워드 배열은 "1등인 사람 찾기"(필터)엔 좋지만 "1·2·3등 순서로 정렬"은
--    별도 처리가 필요하다. 순위 정렬이 실제로 필요해지면 그때 nullable rank 컬럼을
--    추가하면 된다 (기존 행에 영향 없는 무중단 변경).
-- ============================================================================

CREATE TABLE public.club_awards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  year       integer NOT NULL,
  month      integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- 키워드 배열. 클럽이 자유롭게 정한다 ('1등' / 'MVP' / '개근' 등)
  tags       jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  awarded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 한 사람이 같은 달에 두 행을 갖지 않게 한다. 상을 여러 개 받으면 tags 에 함께 넣는다.
  UNIQUE (club_id, year, month, user_id)
);

-- 월별 조회
CREATE INDEX club_awards_club_month_idx ON public.club_awards (club_id, year DESC, month DESC);
-- "이 사람이 최근에 받았나" (향후 쿨다운 판정용)
CREATE INDEX club_awards_user_idx       ON public.club_awards (club_id, user_id, year DESC, month DESC);
-- 키워드 필터
CREATE INDEX club_awards_tags_idx       ON public.club_awards USING gin (tags jsonb_path_ops);

ALTER TABLE public.club_awards ENABLE ROW LEVEL SECURITY;

-- 조회는 공개 — 명예의전당(hall_of_fame)과 같은 성격의 클럽 표창 데이터고,
-- 게스트(anon)도 클럽 화면을 보므로 같은 선례를 따른다.
CREATE POLICY club_awards_select ON public.club_awards
  FOR SELECT TO anon, authenticated USING (true);

-- 기록은 운영진만
CREATE POLICY club_awards_write ON public.club_awards
  FOR ALL TO authenticated
  USING      (public.cmer_is_manager(club_id))
  WITH CHECK (public.cmer_is_manager(club_id));
