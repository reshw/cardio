-- 챌린지 시작 후 참여 허용 여부 (기본값: false = 시작 후 참여 불가)
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS allow_late_join boolean NOT NULL DEFAULT false;
