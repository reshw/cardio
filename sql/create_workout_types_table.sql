-- 운동 종목 관리 테이블 생성
CREATE TABLE IF NOT EXISTS workout_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('km', 'm', '층', '분', '회', '세트')),
  sub_types JSONB DEFAULT '[]'::jsonb,
  sub_type_mode TEXT NOT NULL DEFAULT 'single' CHECK (sub_type_mode IN ('single', 'mixed')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_workout_types_display_order ON workout_types(display_order);
CREATE INDEX IF NOT EXISTS idx_workout_types_is_active ON workout_types(is_active);

-- RLS 정책
ALTER TABLE workout_types ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있음
CREATE POLICY "Anyone can read workout types"
  ON workout_types FOR SELECT
  USING (is_active = true);

-- 어드민만 수정 가능
CREATE POLICY "Only admins can manage workout types"
  ON workout_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- 기존 운동 종목 데이터 마이그레이션
INSERT INTO workout_types (name, emoji, unit, sub_types, sub_type_mode, display_order, is_active) VALUES
  ('달리기', '🏃', 'km', '["트레드밀", "러닝"]'::jsonb, 'single', 1, true),
  ('사이클', '🚴', 'km', '["실외", "실내"]'::jsonb, 'single', 2, true),
  ('수영', '🏊', 'm', '[]'::jsonb, 'single', 3, true),
  ('계단', '🪜', '층', '[]'::jsonb, 'single', 4, true),
  ('복싱', '🥊', '분', '["샌드백/미트", "스파링"]'::jsonb, 'mixed', 5, true),
  ('요가', '🧘', '분', '["일반", "빈야사/아쉬탕가"]'::jsonb, 'mixed', 6, true)
ON CONFLICT (name) DO NOTHING;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_workout_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_types_updated_at
  BEFORE UPDATE ON workout_types
  FOR EACH ROW
  EXECUTE FUNCTION update_workout_types_updated_at();
