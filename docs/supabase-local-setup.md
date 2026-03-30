# Supabase Local Development 설정

## Git 같은 DB 워크플로우

```
로컬 DB (Docker) ←→ Staging DB ←→ Production DB
     ↓                   ↓              ↓
  테스트          스테이징 테스트    실제 운영
```

## 📦 필요한 것

1. **Docker Desktop** - 로컬 Supabase 실행용
2. **Supabase CLI** - DB 관리 도구

## 🔧 설치

### 1. Docker Desktop 설치

https://www.docker.com/products/docker-desktop/

설치 후:
```bash
docker --version
# Docker version 24.0.x 나오면 OK
```

### 2. Supabase CLI 설치

```bash
# Windows (PowerShell)
scoop install supabase

# 또는 직접 다운로드
# https://github.com/supabase/cli/releases
```

확인:
```bash
supabase --version
# 1.x.x 나오면 OK
```

## 🏗️ 프로젝트 설정

### Step 1: Supabase 초기화

```bash
cd D:\dev\cardio

# Supabase 프로젝트 초기화
supabase init

# 생성되는 파일들:
# supabase/
# ├── config.toml       # 로컬 설정
# ├── seed.sql          # 초기 데이터
# └── migrations/       # 마이그레이션 파일들
```

### Step 2: 프로덕션 스키마 가져오기

```bash
# Supabase 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref <your-project-id>

# 💡 Project ID 찾는 법:
# Supabase Dashboard > Settings > General > Reference ID

# 현재 프로덕션 스키마 가져오기 (git pull 같은 개념)
supabase db pull

# 결과: supabase/migrations/에 스키마 파일 생성됨
```

### Step 3: 로컬 Supabase 시작

```bash
# Docker로 로컬 Supabase 실행 (첫 실행은 5분 정도 소요)
supabase start

# 출력 예시:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# Inbucket URL: http://localhost:54324
```

**로컬 접속:**
- Studio (DB 관리): http://localhost:54323
- API: http://localhost:54321

## 🔄 Git 같은 워크플로우

### 시나리오: 마이그레이션 테스트

```bash
# 1. 새 마이그레이션 생성
supabase migration new add_subtype_units

# 생성된 파일:
# supabase/migrations/20260330120000_add_subtype_units.sql
```

### 2. 마이그레이션 작성

**`supabase/migrations/20260330120000_add_subtype_units.sql`**
```sql
-- 계단 서브타입 추가
UPDATE workout_types
SET
  sub_types = '[
    {"name": "시간", "unit": "분"},
    {"name": "층수", "unit": "층"}
  ]'::jsonb,
  sub_type_mode = 'single'
WHERE name = '계단';

-- 달리기
UPDATE workout_types
SET sub_types = '[
  {"name": "트레드밀", "unit": "km"},
  {"name": "러닝", "unit": "km"}
]'::jsonb
WHERE name = '달리기';

-- ... (나머지)
```

### 3. 로컬에서 테스트

```bash
# 로컬 DB에 마이그레이션 적용
supabase db reset

# 또는 마이그레이션만 재실행
supabase migration up

# Studio에서 확인
# http://localhost:54323 → Table Editor → workout_types
```

### 4. 로컬 앱에서 테스트

**.env.local** 생성:
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGc... # supabase start에서 출력된 키
```

```bash
# 로컬 API로 앱 실행
npm run dev

# 이제 계단 운동 등록 테스트!
```

### 5. 프로덕션 적용

```bash
# 문제 없으면 프로덕션에 푸시 (git push 같은 개념)
supabase db push

# 확인 메시지 나옴:
# "Apply 1 migration to production? [y/N]"
# y 입력하면 프로덕션에 적용됨
```

## 🔐 안전 장치

### 자동 백업
```bash
# 로컬에서 스냅샷 저장
supabase db dump -f backup.sql

# 복원
psql -h localhost -p 54322 -U postgres < backup.sql
```

### 롤백
```bash
# 마이그레이션 되돌리기
supabase migration repair --status reverted <timestamp>

# 또는 수동으로 롤백 마이그레이션 작성
supabase migration new revert_subtype_units
```

## 📊 비교: 기존 vs Local Dev

| 작업 | 기존 방식 | Supabase CLI |
|------|----------|--------------|
| 테스트 | ❌ 프로덕션에서 직접 | ✅ 로컬 Docker |
| 백업 | 🔴 수동 SQL | 🟢 자동 스냅샷 |
| 롤백 | 🔴 수동 쿼리 | 🟢 `migration repair` |
| 협업 | 🔴 SQL 파일 공유 | 🟢 Git으로 migration 공유 |
| 히스토리 | ❌ 없음 | ✅ migrations/ 폴더 |

## 🎯 즉시 사용 가능한 명령어

```bash
# 로컬 DB 상태 확인
supabase status

# 로컬 DB 중지
supabase stop

# 로컬 DB 완전 삭제 (재설치)
supabase stop --no-backup
rm -rf supabase/.branches

# 프로덕션과 로컬 차이 확인
supabase db diff

# 시드 데이터 추가
# supabase/seed.sql 편집 후
supabase db reset
```

## 🔄 일상적인 워크플로우

```bash
# 매일 아침
supabase start           # 로컬 DB 시작
supabase db pull         # 프로덕션 최신 스키마 가져오기

# 마이그레이션 작업
supabase migration new my_change
# 파일 편집
supabase db reset        # 로컬 테스트
npm run dev              # 앱 테스트

# 문제 없으면
git add supabase/migrations/
git commit -m "migration: ..."
git push

# 배포
supabase db push         # 프로덕션 적용
```

## ⚠️ 주의사항

1. **Docker 필수** - Docker Desktop이 실행 중이어야 함
2. **포트 충돌** - 54321-54324 포트가 비어있어야 함
3. **첫 실행 느림** - Docker 이미지 다운로드 (5분)
4. **디스크 공간** - 최소 2GB 필요

## 🆘 문제 해결

### Docker 시작 안 됨
```bash
# Docker Desktop 재시작
# 그래도 안되면:
supabase stop --no-backup
docker system prune -a
supabase start
```

### 포트 이미 사용 중
```bash
# config.toml 편집
# [api]
# port = 54321  →  port = 55321 으로 변경
```

### 마이그레이션 충돌
```bash
# 로컬 리셋
supabase db reset

# 프로덕션 다시 가져오기
supabase db pull --force
```

## 📚 더 알아보기

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Database Migrations](https://supabase.com/docs/guides/cli/managing-environments)
