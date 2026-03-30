-- System Settings 테이블 생성
-- 시스템 전역 설정을 저장하는 테이블

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at DESC);

-- RLS (Row Level Security) 활성화
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자는 읽기 가능
CREATE POLICY "Anyone can read system settings"
  ON system_settings
  FOR SELECT
  USING (true);

-- 정책: 관리자만 쓰기 가능
CREATE POLICY "Only admins can modify system settings"
  ON system_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- 기본 이미지 설정 삽입
INSERT INTO system_settings (key, value)
VALUES (
  'image_upload',
  '{
    "max_width": 1280,
    "quality": 75,
    "thumbnail_size": 300
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 코멘트 추가
COMMENT ON TABLE system_settings IS '시스템 전역 설정';
COMMENT ON COLUMN system_settings.key IS '설정 키 (예: image_upload, notification_config)';
COMMENT ON COLUMN system_settings.value IS '설정 값 (JSONB 형식)';
COMMENT ON COLUMN system_settings.updated_by IS '마지막 수정한 관리자 ID';
