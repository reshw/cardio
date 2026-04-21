-- race_records 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS race_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  race_name text NOT NULL,
  race_date date NOT NULL,
  category text NOT NULL,
  finish_time text NOT NULL,
  image_url text,
  link_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE race_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 전부 제거
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'race_records' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON race_records', pol.policyname);
  END LOOP;
END $$;

-- 이 앱은 custom auth (localStorage)를 사용하므로 auth.uid() 미사용
-- 다른 테이블과 동일하게 app layer에서 권한 관리
CREATE POLICY "race_select" ON race_records FOR SELECT USING (true);
CREATE POLICY "race_insert" ON race_records FOR INSERT WITH CHECK (true);
CREATE POLICY "race_update" ON race_records FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "race_delete" ON race_records FOR DELETE USING (true);

GRANT ALL ON race_records TO authenticated;
GRANT ALL ON race_records TO anon;
