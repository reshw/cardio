# 안전한 DB 마이그레이션 가이드

## 🚨 현재 상황
- **프로덕션 DB 1개만 존재**
- 마이그레이션 테스트 환경 없음
- 잘못하면 실제 사용자 데이터 손상 위험

## ✅ 즉시 실행 (5분)

### 1. 프로덕션 백업 (지금 당장!)

```sql
-- Supabase Dashboard > SQL Editor에서 실행
-- sql/backup_before_migration.sql 파일 내용 실행
```

**백업 확인:**
```sql
SELECT COUNT(*) FROM workout_types_backup_20260330;
```

### 2. 안전한 마이그레이션 순서

#### Step 1: Read-Only 확인
```sql
-- 마이그레이션이 데이터를 읽기만 하는지 확인
-- migrate_workout_subtypes_with_units.sql은 UPDATE만 함
```

#### Step 2: 한 줄씩 실행
```sql
-- 전체 실행 ❌
-- 한 줄씩 복사해서 실행 ✅

-- 1) 계단부터 테스트
UPDATE workout_types
SET
  sub_types = '[
    {"name": "시간", "unit": "분"},
    {"name": "층수", "unit": "층"}
  ]'::jsonb,
  sub_type_mode = 'single'
WHERE name = '계단';

-- 2) 결과 확인
SELECT name, sub_types FROM workout_types WHERE name = '계단';

-- 3) 문제 없으면 다음 운동 진행...
```

#### Step 3: 즉시 롤백 가능하도록 준비
```sql
-- 문제 발생 시 바로 실행할 롤백 쿼리 준비
UPDATE workout_types
SET sub_types = '[]'::jsonb
WHERE name = '계단';
```

## 🏗️ 장기 대책: Staging DB 구축 (30분)

### 방법 1: Supabase 무료 프로젝트 추가

1. **새 Supabase 프로젝트 생성**
   - Dashboard > New Project
   - 이름: `cardio-staging`
   - 무료 플랜 선택

2. **스키마 복제**
   ```bash
   # 프로덕션 스키마 덤프
   # Supabase는 pg_dump 직접 사용 불가
   # Dashboard에서 수동으로 테이블 생성 스크립트 복사
   ```

3. **환경변수 분리**
   ```env
   # .env.production
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...

   # .env.staging
   VITE_SUPABASE_URL=https://yyy.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

4. **빌드 스크립트 추가**
   ```json
   // package.json
   {
     "scripts": {
       "build:staging": "vite build --mode staging",
       "build:production": "vite build --mode production"
     }
   }
   ```

### 방법 2: 로컬 Supabase (고급)

```bash
# Docker 필요
npx supabase init
npx supabase start

# 로컬에서 테스트 후 프로덕션 적용
npx supabase db push
```

## 📋 마이그레이션 체크리스트

프로덕션 실행 전 확인:

- [ ] 백업 완료 (`workout_types_backup_20260330` 테이블 생성됨)
- [ ] 롤백 쿼리 준비됨
- [ ] 한 줄씩 실행 계획 수립
- [ ] 사용자 트래픽 적은 시간대 선택 (새벽 2-4시?)
- [ ] 실행 후 즉시 앱에서 테스트 가능한 상태

## 🔄 롤백 절차

```sql
-- 1. 백업에서 복원
DELETE FROM workout_types;
INSERT INTO workout_types
SELECT * FROM workout_types_backup_20260330;

-- 2. 확인
SELECT name, sub_types FROM workout_types ORDER BY display_order;
```

## 💡 권장사항

**지금 당장:**
1. ✅ 백업 실행 (`backup_before_migration.sql`)
2. ✅ 새벽 시간대에 한 줄씩 마이그레이션
3. ✅ 각 단계마다 결과 확인

**이번 주 안에:**
1. 🏗️ Staging Supabase 프로젝트 생성
2. 🏗️ 스키마 복제
3. 🏗️ Staging 환경에서 마이그레이션 전체 테스트

**앞으로:**
- 모든 DB 변경은 Staging에서 먼저 테스트
- 마이그레이션 스크립트는 반드시 롤백 스크립트와 함께 작성
- 주요 변경 전 항상 백업

## ⚠️ 위험도 평가

**이번 마이그레이션:**
- 위험도: 🟡 중간
- 이유: UPDATE만 하고, JSONB 구조 변경
- 영향: 모든 workout_types (6-10개 row)
- 롤백: 가능 (백업 있으면)

**더 위험한 것들:**
- DELETE, DROP: 🔴 높음
- ALTER TABLE ADD COLUMN: 🟢 낮음
- INSERT: 🟢 낮음
