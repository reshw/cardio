# Docker 설치 후 바로 실행

## ✅ Docker 설치 완료 확인

```bash
# PowerShell에서 실행
docker --version

# 출력 예시:
# Docker version 24.0.7, build...
```

**에러 나면:** Docker Desktop 앱 실행 후 다시 시도

---

## 🚀 즉시 실행 (5분)

### 1단계: Supabase CLI 설치

```bash
# PowerShell (관리자 권한)
scoop install supabase

# scoop 없으면 먼저 설치:
# Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
# irm get.scoop.sh | iex

# 확인
supabase --version
```

**또는 winget:**
```bash
winget install Supabase.CLI
```

---

### 2단계: 프로젝트 초기화

```bash
cd D:\dev\cardio

# Supabase 초기화
supabase init

# 생성된 폴더 확인
ls supabase/
# config.toml
# seed.sql
# migrations/
```

---

### 3단계: 로컬 Supabase 시작 🎉

```bash
# 첫 실행 (Docker 이미지 다운로드 5분)
supabase start

# 출력 예시:
# Started supabase local development setup.
#
#          API URL: http://localhost:54321
#      GraphQL URL: http://localhost:54321/graphql/v1
#           DB URL: postgresql://postgres:postgres@localhost:54322/postgres
#       Studio URL: http://localhost:54323  👈 여기!
#     Inbucket URL: http://localhost:54324
#       JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
#         anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ 위 출력을 복사해두세요!** (특히 anon key)

---

### 4단계: Studio 접속

브라우저 열기:
```
http://localhost:54323
```

**보이는 것:**
- Table Editor (테이블 없음 - 정상!)
- SQL Editor
- Authentication
- Storage

---

### 5단계: 프로덕션 스키마 가져오기

```bash
# Supabase 로그인
supabase login

# 브라우저 열리면 로그인

# 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_ID

# 💡 Project ID 찾기:
# Supabase Dashboard → Settings → General → Reference ID
# 예시: abcdefghijklmnop

# 스키마 가져오기 (git pull 같은 개념)
supabase db pull

# 출력:
# Finished supabase db pull.
```

---

### 6단계: 로컬 DB에 적용

```bash
# 로컬 DB 초기화 (마이그레이션 적용)
supabase db reset

# 출력:
# Applying migration 20240101000000_initial_schema.sql...
# Finished supabase db reset.
```

**Studio 새로고침:**
- http://localhost:54323
- Table Editor → 모든 테이블 보임! 🎉

---

### 7단계: 로컬 앱 실행

```bash
# .env.local 파일 생성
echo 'VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' > .env.local

# 앱 실행
npm run dev:local

# 브라우저: http://localhost:5173
```

---

## 🎯 마이그레이션 테스트

### 방법 1: Studio에서 직접

```bash
# 1. Studio SQL Editor
http://localhost:54323 → SQL Editor

# 2. 마이그레이션 복사/붙여넣기
# sql/migrate_workout_subtypes_SAFE.sql 내용 붙여넣고 실행

# 3. Table Editor에서 확인
# workout_types → sub_types 컬럼 확인
```

### 방법 2: 마이그레이션 파일 (권장)

```bash
# 1. 새 마이그레이션 생성
supabase migration new add_subtype_units

# 2. 파일 편집
# supabase/migrations/20260330XXXXXX_add_subtype_units.sql
# ← sql/migrate_workout_subtypes_SAFE.sql 내용 복사

# 3. 로컬 적용
supabase db reset

# 4. 앱 테스트
npm run dev:local
# 계단 운동 등록 → 시간/층수 선택 확인!
```

---

## 🎉 성공 확인

✅ **체크리스트:**
- [ ] `docker --version` 동작
- [ ] `supabase --version` 동작
- [ ] `supabase start` 성공
- [ ] http://localhost:54323 접속됨
- [ ] `supabase db pull` 완료
- [ ] Studio에 테이블 보임
- [ ] `npm run dev:local` 실행
- [ ] 앱에서 로그인 가능

---

## 🚀 프로덕션 적용

```bash
# 로컬 테스트 완료 후

# 프로덕션에 마이그레이션 푸시
supabase db push

# 확인 메시지:
# "Apply 1 migration to production database? [y/N]"

# y 입력하면 프로덕션 적용!
```

---

## 🔄 일상 사용법

```bash
# 매일 아침
supabase start           # 로컬 DB 시작 (2초)
npm run dev:local        # 앱 실행

# 마이그레이션 작업
supabase migration new my_change
# 파일 편집
supabase db reset        # 로컬 테스트
npm run dev:local        # 앱 테스트

# 완료
git add supabase/migrations/
git commit -m "..."
supabase db push         # 프로덕션 적용
```

---

## 💡 유용한 명령어

```bash
# 상태 확인
supabase status

# 로컬 DB 중지
supabase stop

# 로컬 DB 완전 초기화
supabase stop --no-backup
supabase start

# Studio 열기
start http://localhost:54323

# 로그 보기
supabase logs db
```

---

## 🆘 문제 해결

### Docker가 안 켜져요
```bash
# Docker Desktop 앱을 수동으로 실행
# Windows 시작 메뉴 → Docker Desktop
```

### "Cannot connect to Docker"
```bash
# 1. Docker Desktop 실행 확인
# 2. WSL2 업데이트 (Windows 11)
wsl --update

# 3. Docker Desktop 재시작
```

### 포트 이미  사용 중
```bash
# supabase/config.toml 편집
# [api]
# port = 54321  →  55321
```

### 마이그레이션 꼬임
```bash
# 로컬 완전 리셋
supabase stop --no-backup
rm -rf supabase/.branches
supabase start
supabase db pull
supabase db reset
```

---

## 📋 요약

1. ✅ Docker 설치 완료
2. ⚡ `scoop install supabase`
3. 🎬 `supabase init`
4. 🔗 `supabase link`
5. 📥 `supabase db pull`
6. 🚀 `supabase start`
7. 🎉 `npm run dev:local`

**소요 시간:** 5-10분
