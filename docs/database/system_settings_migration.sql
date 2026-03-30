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

-- RLS 비활성화 (내부 관리 도구이므로 단순화)
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Anyone can read system settings" ON system_settings;
DROP POLICY IF EXISTS "Only admins can modify system settings" ON system_settings;
DROP POLICY IF EXISTS "Super admins can insert settings" ON system_settings;
DROP POLICY IF EXISTS "Super admins can update settings" ON system_settings;
DROP POLICY IF EXISTS "Super admins can delete settings" ON system_settings;

-- 보안은 프론트엔드의 is_super_admin 체크로 충분
-- (내부 관리 도구, 직접 DB 접근 가능한 슈퍼 관리자만 사용)

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
