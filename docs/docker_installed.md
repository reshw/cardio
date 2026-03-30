# Docker 설치 완료 - 재부팅 후 진행사항

**상태:** Docker Desktop 설치 완료 → 재부팅 필요 → 이후 작업 대기

**목표:** 로컬 Supabase 환경 구축 후 마이그레이션 테스트

---

## 🎯 재부팅 후 즉시 실행

### 1단계: Docker Desktop 확인 (1분)

```powershell
# PowerShell 열기

# Docker 확인
docker --version

# 예상 출력:
# Docker version 24.0.7, build...
```

**에러 나면:**
- Windows 시작 메뉴 → Docker Desktop 실행
- 우측 하단 트레이에 Docker 아이콘 확인
- "Docker Desktop is running" 나올 때까지 대기 (1-2분)
- 다시 `docker --version` 실행

---

### 2단계: Supabase CLI 설치 (2분)

```powershell
# PowerShell (관리자 권한으로 실행)

# 방법 1: Scoop (추천)
# Scoop 없으면 먼저 설치:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Supabase CLI 설치
scoop install supabase

# 방법 2: winget
winget install Supabase.CLI

# 확인
supabase --version
# 출력: 1.x.x
```

---

### 3단계: 프로젝트 초기화 (10초)

```powershell
cd D:\dev\cardio

# Supabase 초기화
supabase init

# 생성되는 파일들:
# supabase/
# ├── config.toml       # 설정
# ├── seed.sql          # 초기 데이터
# └── migrations/       # 마이그레이션 폴더
```

**확인:**
```powershell
ls supabase
```

---

### 4단계: Supabase 로그인 (30초)

```powershell
# 로그인 (브라우저 자동 열림)
supabase login

# 브라우저에서:
# 1. Supabase 계정으로 로그인
# 2. "Authorize" 클릭
# 3. PowerShell로 돌아오기

# 성공 메시지:
# Finished supabase login.
```

---

### 5단계: 프로젝트 연결 (30초)

```powershell
# 프로덕션 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_ID

# 💡 Project ID 찾는 법:
# 1. https://supabase.com/dashboard 접속
# 2. cardio 프로젝트 선택
# 3. Settings → General
# 4. "Reference ID" 복사 (예: abcdefghijklmnop)

# 입력 예시:
# supabase link --project-ref abcdefghijklmnop

# Database password 입력 요구되면:
# Supabase 프로젝트 생성 시 설정한 비밀번호 입력
```

**성공 메시지:**
```
Finished supabase link.
```

---

### 6단계: 프로덕션 스키마 가져오기 (1분)

```powershell
# 프로덕션 DB 스키마를 로컬로 가져오기 (git pull 같은 개념)
supabase db pull

# 프로세스:
# 1. 프로덕션 DB 연결
# 2. 스키마 추출
# 3. supabase/migrations/ 폴더에 SQL 파일 생성

# 생성된 파일 확인:
ls supabase/migrations/
# 20240101000000_remote_schema.sql (날짜는 다를 수 있음)
```

---

### 7단계: 로컬 Supabase 시작 🚀 (첫 실행 5분)

```powershell
# 로컬 Docker로 Supabase 실행
supabase start

# 첫 실행: Docker 이미지 다운로드 (5분 소요)
# 이후 실행: 2초만에 시작

# 완료 시 출력:
```

```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323  👈 이거!
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ 이 출력을 복사해서 저장하세요!** (특히 anon key)

---

### 8단계: Studio 접속 (10초)

브라우저에서:
```
http://localhost:54323
```

**보이는 것:**
- 🎨 깔끔한 UI
- 📊 Table Editor (아직 테이블 없음 - 정상!)
- 💾 SQL Editor
- 🔐 Authentication
- 📦 Storage

---

### 9단계: 로컬 DB 초기화 (30초)

```powershell
# 프로덕션 스키마를 로컬 DB에 적용
supabase db reset

# 프로세스:
# 1. 로컬 DB 초기화
# 2. migrations/ 폴더의 SQL 파일 순차 실행
# 3. 테이블, 함수, RLS 정책 등 모두 생성

# 완료 메시지:
# Finished supabase db reset on branch main.
```

**확인:**
- http://localhost:54323 새로고침
- Table Editor → 모든 테이블 보임! 🎉
  - users
  - workouts
  - clubs
  - workout_types
  - ...

---

### 10단계: 로컬 앱 연결 (1분)

```powershell
# .env.local 파일 생성
cd D:\dev\cardio

# 파일 생성 (메모장으로 편집)
notepad .env.local
```

**.env.local 내용:**
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# R2 설정 (기존과 동일)
R2_ACCOUNT_ID=f333c2cae710ec01c945bb89ea0bb7d8
R2_ACCESS_KEY_ID=07f8b077120f187d6d23bba92d86e49b
R2_SECRET_ACCESS_KEY=1feccdce52784013d7e911068b77fd2357e7c9e4c54d6fa4e873a95d7c9a4c75
R2_BUCKET_NAME=cardio
R2_PUBLIC_URL=https://img.scnd.kr
```

**저장 후:**
```powershell
# 앱 실행 (로컬 DB 사용)
npm run dev:local

# 브라우저 자동 열림: http://localhost:5173
```

---

## 🎯 마이그레이션 테스트

### 방법 1: Studio SQL Editor (간단)

1. **Studio 열기:** http://localhost:54323
2. **SQL Editor 클릭**
3. **마이그레이션 복사/붙여넣기:**
   - `D:\dev\cardio\sql\migrate_workout_subtypes_SAFE.sql` 열기
   - 전체 복사
   - SQL Editor에 붙여넣기
   - 한 블록씩 선택해서 실행 (Ctrl+Enter)
4. **확인:**
   - Table Editor → workout_types
   - sub_types 컬럼 확인
   - 계단: `[{"name": "시간", "unit": "분"}, {"name": "층수", "unit": "층"}]`

### 방법 2: 마이그레이션 파일 (권장)

```powershell
# 1. 새 마이그레이션 생성
supabase migration new add_subtype_units

# 생성된 파일:
# supabase/migrations/20260330XXXXXX_add_subtype_units.sql

# 2. 파일 편집
notepad supabase/migrations/20260330*_add_subtype_units.sql

# 3. 내용 복사
# sql/migrate_workout_subtypes_SAFE.sql의 UPDATE 문들만 복사
# (확인 쿼리는 제외, UPDATE만)

# 4. 저장

# 5. 로컬 적용
supabase db reset

# 6. Studio에서 확인
# http://localhost:54323 → Table Editor → workout_types
```

---

## ✅ 앱 테스트

```powershell
# 앱 실행 (로컬 DB)
npm run dev:local
```

**브라우저에서 테스트:**
1. 로그인 (카카오톡)
2. "기록 추가" 클릭
3. "계단" 선택
4. **세부 종류에 "시간", "층수" 버튼 보임?** ✅
5. "시간" 선택 → 입력 라벨이 "분" ✅
6. "층수" 선택 → 입력 라벨이 "층" ✅
7. 값 입력 후 저장

**문제 없으면 성공!** 🎉

---

## 🚀 프로덕션 적용

```powershell
# 로컬 테스트 완료 후

# Git 커밋 (마이그레이션 파일)
git add supabase/migrations/
git commit -m "migration: add subtype units for dynamic labels"
git push origin dev

# 프로덕션 적용
supabase db push

# 확인 메시지:
# "Apply 1 migration to abcdefghijklmnop (cardio)? [y/N]"

# y 입력
# 프로덕션 DB에 마이그레이션 적용됨!
```

**최종 확인:**
- 프로덕션 앱에서 계단 운동 추가
- 시간/층수 선택 확인
- 단위 라벨 확인

---

## 💡 자주 쓰는 명령어

```powershell
# 로컬 Supabase 시작/종료
supabase start              # 시작 (이후 2초)
supabase stop               # 종료
supabase status             # 상태 확인

# DB 작업
supabase db reset           # 로컬 DB 초기화 (모든 마이그레이션 재적용)
supabase db pull            # 프로덕션 스키마 가져오기
supabase db push            # 프로덕션 적용

# 마이그레이션
supabase migration new NAME # 새 마이그레이션 생성
supabase migration list     # 마이그레이션 목록

# Studio 열기
start http://localhost:54323

# 앱 실행
npm run dev:local           # 로컬 DB
npm run dev                 # 프로덕션 DB
```

---

## 🆘 트러블슈팅

### Docker Desktop이 시작 안 됨
```
해결:
1. Windows 시작 메뉴 → Docker Desktop 실행
2. 트레이 아이콘 확인
3. "Starting..." 에서 "Running" 될 때까지 대기
```

### "Cannot connect to Docker daemon"
```powershell
# Docker Desktop 실행 확인
# WSL2 업데이트 (Windows 11)
wsl --update

# Docker Desktop 재시작
```

### supabase start 에러: "port already in use"
```powershell
# 포트 변경
notepad supabase/config.toml

# [api] 섹션에서:
# port = 54321  →  port = 55321

# 재시작
supabase stop
supabase start
```

### 마이그레이션 꼬임
```powershell
# 로컬 완전 초기화
supabase stop --no-backup
rm -rf supabase/.branches
supabase start
supabase db pull
supabase db reset
```

### 로그인 안 됨 (앱)
```
확인 사항:
1. .env.local 파일 존재?
2. VITE_SUPABASE_URL = http://localhost:54321?
3. supabase status로 API URL 확인
4. npm run dev:local로 실행했는지 확인
```

---

## 📋 체크리스트

재부팅 후:
- [ ] `docker --version` 동작 확인
- [ ] `scoop install supabase` 설치
- [ ] `supabase init` 초기화
- [ ] `supabase login` 로그인
- [ ] `supabase link` 프로젝트 연결
- [ ] `supabase db pull` 스키마 가져오기
- [ ] `supabase start` 로컬 시작 (5분)
- [ ] http://localhost:54323 접속 확인
- [ ] `supabase db reset` DB 초기화
- [ ] Studio에서 테이블 확인
- [ ] `.env.local` 파일 생성
- [ ] `npm run dev:local` 앱 실행
- [ ] 마이그레이션 테스트
- [ ] 계단 운동 추가 테스트 (시간/층수)
- [ ] `supabase db push` 프로덕션 적용

---

## 🎯 현재 작업 상황

**완료:**
- ✅ Docker Desktop 설치
- ✅ 재부팅 대기

**다음:**
1. 재부팅
2. Docker 확인
3. Supabase CLI 설치
4. 로컬 환경 구축
5. 마이그레이션 테스트
6. 프로덕션 적용

**예상 소요 시간:** 15-20분

---

## 📚 관련 문서

- `DOCKER_NEXT_STEPS.md` - 단계별 가이드
- `docs/supabase-local-setup.md` - 상세 문서
- `sql/migrate_workout_subtypes_SAFE.sql` - 마이그레이션 파일
- `MIGRATION_OPTIONS.md` - 마이그레이션 방법 비교

---

## 💬 다음 단계

재부팅 후:
1. PowerShell 열기
2. `docker --version` 실행
3. 이 문서 보면서 진행
4. 막히면 트러블슈팅 섹션 참고

**화이팅! 거의 다 왔어요! 🚀**
