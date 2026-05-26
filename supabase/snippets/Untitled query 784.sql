  -- 현재 정책 확인                                                       SELECT policyname, cmd, qual, with_check
  FROM pg_policies                                                      
  WHERE tablename = 'race_records';
  
  결과 보여주시면 정확히 뭐가 문제인지 알 수 있지만, 일단 전체
  재설정으로 해결 가능합니다:

  -- 기존 정책 전부 삭제
  DROP POLICY IF EXISTS "Users can insert own race records" ON
  race_records;
  DROP POLICY IF EXISTS "Users can select own race records" ON
  race_records;
  DROP POLICY IF EXISTS "Users can update own race records" ON
  race_records;
  DROP POLICY IF EXISTS "Users can delete own race records" ON
  race_records;

  -- 혹시 다른 이름으로 있을 수도 있으니 전체 삭제
  DO $$
  DECLARE
    pol RECORD;
  BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename =     
  'race_records' LOOP
      EXECUTE 'DROP POLICY "' || pol.policyname || '" ON race_records'; 
    END LOOP;
  END $$;

  -- 새로 생성
  CREATE POLICY "insert_own" ON race_records
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "select_own" ON race_records
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "update_own" ON race_records
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "delete_own" ON race_records
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);