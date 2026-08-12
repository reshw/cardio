-- ============================================
-- 클럽별 opt-in 기능 (탭 관리)
-- 계획: docs/plans/클럽-탭-optin.md
-- 클럽달력을 상시 노출 탭에서 opt-in 으로 전환 — 행사가 잦지 않은 소규모 클럽엔
-- 노이즈였음. 기존 클럽 포함 전부 기본 OFF('{}')로 시작, 방장이 직접 켠다.
-- ============================================

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS enabled_features text[] NOT NULL DEFAULT '{}';
