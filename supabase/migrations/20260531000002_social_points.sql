-- 소셜 포인트 테이블
CREATE TABLE IF NOT EXISTS social_points (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points      INT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('share', 'gathering', 'cafe_post', 'referral', 'training', 'donation')),
  description TEXT,
  memo_url    TEXT,
  ref_id      UUID,
  awarded_by  UUID REFERENCES users(id),
  year        INT NOT NULL,
  month       INT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_points_club_year_month ON social_points(club_id, year, month);
CREATE INDEX IF NOT EXISTS idx_social_points_user ON social_points(user_id);

-- 카톡 공유 하루 1회 중복 방지 인덱스
-- DATE_TRUNC('day', timestamptz) 는 세션 타임존에 의존해 STABLE 이라 인덱스 표현식으로 못 씀
-- (CREATE UNIQUE INDEX ... DATE_TRUNC(...) 는 "functions in index expression must be marked
-- IMMUTABLE" 에러로 실패함). AT TIME ZONE 뒤에 INTERVAL(고정 오프셋)을 쓰면 timezone(interval,
-- timestamptz) 함수가 호출되어 IMMUTABLE 이 되므로, KST 고정 오프셋(+09:00)으로 하루 경계를 계산.
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_points_share_daily
  ON social_points(club_id, user_id, action_type, ((created_at AT TIME ZONE INTERVAL '+09:00')::date))
  WHERE action_type = 'share';

ALTER TABLE social_points DISABLE ROW LEVEL SECURITY;

-- 소모임 신청 테이블
CREATE TABLE IF NOT EXISTS social_gatherings (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description  TEXT,
  gathered_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by  UUID REFERENCES users(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_gatherings_club ON social_gatherings(club_id, status);

ALTER TABLE social_gatherings DISABLE ROW LEVEL SECURITY;

-- 소모임 참가자 테이블
CREATE TABLE IF NOT EXISTS social_gathering_members (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gathering_id UUID NOT NULL REFERENCES social_gatherings(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(gathering_id, user_id)
);

ALTER TABLE social_gathering_members DISABLE ROW LEVEL SECURITY;
