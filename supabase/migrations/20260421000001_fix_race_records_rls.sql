-- 이 앱은 custom auth (localStorage)를 사용하므로 auth.uid() 미사용
-- 기존 정책 제거 후 다른 테이블과 동일하게 app layer 방식으로 재생성
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'race_records' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON race_records', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "race_select" ON race_records FOR SELECT USING (true);
CREATE POLICY "race_insert" ON race_records FOR INSERT WITH CHECK (true);
CREATE POLICY "race_update" ON race_records FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "race_delete" ON race_records FOR DELETE USING (true);

GRANT ALL ON race_records TO authenticated;
GRANT ALL ON race_records TO anon;
