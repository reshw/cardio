-- ============================================================
-- workouts 테이블 트리거: club_workout_mileage 자동 동기화
-- 승인자: yangxsky / 2026-04-26
-- ============================================================

-- 트리거 함수
CREATE OR REPLACE FUNCTION sync_club_workout_mileage()
RETURNS TRIGGER AS $$
DECLARE
  club_rec    RECORD;
  mileage     NUMERIC;
  coeff       NUMERIC;
  kst_time    TIMESTAMPTZ;
  kst_year    INT;
  kst_month   INT;
  kst_date    DATE;
  ratio_key   TEXT;
  ratio_val   NUMERIC;
  target_row  workouts%ROWTYPE;
BEGIN
  -- DELETE: 스냅샷에서 제거
  IF TG_OP = 'DELETE' THEN
    DELETE FROM club_workout_mileage WHERE workout_id = OLD.id;
    RETURN OLD;
  END IF;

  target_row := NEW;

  -- UPDATE이고 값/시간/서브타입이 바뀌지 않았으면 스킵 (memo, proof_image 등 변경 무시)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.value = NEW.value
      AND OLD.workout_time = NEW.workout_time
      AND OLD.category = NEW.category
      AND (OLD.sub_type IS NOT DISTINCT FROM NEW.sub_type)
      AND (OLD.sub_type_ratios IS NOT DISTINCT FROM NEW.sub_type_ratios)
    THEN
      RETURN NEW;
    END IF;
    -- 마일리지 관련 필드가 바뀐 경우 기존 레코드 삭제 후 재계산
    DELETE FROM club_workout_mileage WHERE workout_id = NEW.id;
  END IF;

  -- KST 날짜 계산
  kst_time  := target_row.workout_time AT TIME ZONE 'Asia/Seoul';
  kst_year  := EXTRACT(YEAR  FROM kst_time)::INT;
  kst_month := EXTRACT(MONTH FROM kst_time)::INT;
  kst_date  := kst_time::DATE;

  -- 이 유저가 속한 모든 클럽에 대해 마일리지 계산 후 저장
  FOR club_rec IN
    SELECT club_id FROM club_members WHERE user_id = target_row.user_id
  LOOP
    mileage := 0;

    -- sub_type_ratios 있는 경우: 혼합 비율로 계산 (요가/복싱 등)
    IF target_row.sub_type_ratios IS NOT NULL
       AND target_row.sub_type_ratios != '{}'::jsonb
    THEN
      FOR ratio_key, ratio_val IN
        SELECT key, value::text::numeric
        FROM jsonb_each_text(target_row.sub_type_ratios)
      LOOP
        SELECT coefficient INTO coeff
        FROM club_mileage_configs
        WHERE club_id = club_rec.club_id
          AND category = target_row.category
          AND sub_type = ratio_key
          AND enabled  = true;

        IF FOUND AND coeff > 0 THEN
          mileage := mileage + (target_row.value * ratio_val / coeff);
        END IF;
      END LOOP;

    -- 단일 sub_type 또는 sub_type 없는 경우
    ELSE
      SELECT coefficient INTO coeff
      FROM club_mileage_configs
      WHERE club_id = club_rec.club_id
        AND category = target_row.category
        AND sub_type IS NOT DISTINCT FROM target_row.sub_type
        AND enabled  = true;

      IF FOUND AND coeff > 0 THEN
        mileage := target_row.value / coeff;
      END IF;
    END IF;

    -- UPSERT (mileage=0이어도 기록: 비활성 카테고리 추적 + 재활성화 시 재계산 가능)
    INSERT INTO club_workout_mileage (
      club_id, workout_id, user_id,
      mileage, year, month, workout_date,
      calculated_at
    ) VALUES (
      club_rec.club_id,
      target_row.id,
      target_row.user_id,
      mileage,
      kst_year, kst_month, kst_date,
      now()
    )
    ON CONFLICT ON CONSTRAINT club_workout_mileage_club_workout_unique
    DO UPDATE SET
      mileage      = EXCLUDED.mileage,
      year         = EXCLUDED.year,
      month        = EXCLUDED.month,
      workout_date = EXCLUDED.workout_date,
      calculated_at = EXCLUDED.calculated_at;

  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 등록
DROP TRIGGER IF EXISTS trg_sync_club_workout_mileage ON workouts;

CREATE TRIGGER trg_sync_club_workout_mileage
  AFTER INSERT OR UPDATE OR DELETE ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION sync_club_workout_mileage();
