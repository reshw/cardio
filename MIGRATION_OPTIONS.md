# 마이그레이션 테스트 방법 선택

## 🎯 3가지 방법 비교

| | 옵션 1: 조심히 직접 | 옵션 2: Staging DB | 옵션 3: Docker 로컬 |
|---|---|---|---|
| **설치** | 없음 | 없음 | Docker (2GB) |
| **시간** | 5분 | 10분 | 15분 |
| **안전성** | 🟡 중간 | 🟢 안전 | 🟢 매우 안전 |
| **비용** | 무료 | 무료 | 무료 |
| **속도** | 빠름 | 보통 | 빠름 |
| **추천** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 옵션 1: 프로덕션에 조심히 적용

### 언제?
- 지금 당장 적용하고 싶을 때
- 설치 싫을 때
- 위험 감수 가능할 때

### 방법
```sql
-- 1. 백업 (sql/backup_before_migration.sql)
-- 2. 한 줄씩 실행 (sql/migrate_workout_subtypes_SAFE.sql)
-- 3. 각 단계마다 확인
-- 4. 문제 있으면 즉시 롤백
```

### 장점
- ✅ 빠름 (5분)
- ✅ 설치 불필요

### 단점
- ❌ 실수하면 프로덕션 영향
- ❌ 롤백 필요 시 긴장됨

### 가이드
- `docs/safe-migration-guide.md`
- `sql/backup_before_migration.sql`
- `sql/migrate_workout_subtypes_SAFE.sql`

---

## 옵션 2: Staging DB (추천!) 🌟

### 언제?
- Docker 설치 부담스러울 때
- 안전하게 테스트하고 싶을 때
- **지금 상황에 딱!**

### 방법
```bash
# 1. Supabase Dashboard에서 새 프로젝트 생성
#    이름: cardio-staging
#    플랜: Free

# 2. .env.staging 파일 생성
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# 3. Staging SQL 에디터에서 스키마 복사
#    (기존 테이블 CREATE 문 실행)

# 4. 마이그레이션 테스트
#    Staging SQL 에디터 → 마이그레이션 실행

# 5. 앱 테스트
npm run dev:staging

# 6. 문제 없으면 프로덕션 적용
```

### 장점
- ✅ 완전히 독립적인 환경
- ✅ 설치 불필요
- ✅ 디스크 0GB
- ✅ 실수해도 프로덕션 안전

### 단점
- ❌ 스키마 복제 필요 (1회)
- ❌ 인터넷 필요

### 가이드
- `docs/staging-db-without-docker.md`

---

## 옵션 3: Docker 로컬 (최고!)

### 언제?
- 완벽한 로컬 개발 환경 원할 때
- Git처럼 DB 관리하고 싶을 때
- 디스크 2GB 여유 있을 때

### 방법
```bash
# 1. Docker Desktop 설치 (무료!)
#    https://www.docker.com/products/docker-desktop/

# 2. Supabase CLI 설치
scoop install supabase

# 3. 초기화
supabase init
supabase link --project-ref YOUR_ID
supabase db pull

# 4. 로컬 시작
npm run db:start

# 5. 마이그레이션 테스트
supabase migration new add_subtype_units
# 파일 편집 후
npm run db:reset

# 6. 앱 테스트
npm run dev:local

# 7. 프로덕션 적용
npm run db:push
```

### 장점
- ✅ 완전한 로컬 환경
- ✅ 빠른 속도
- ✅ Git처럼 버전 관리
- ✅ 팀 협업 가능
- ✅ CI/CD 가능

### 단점
- ❌ Docker 설치 필요 (2GB)
- ❌ 첫 설정 15분

### 가이드
- `setup-local-supabase.md`
- `docs/supabase-local-setup.md`

---

## 🎯 내 추천

### 지금 (오늘)
**→ 옵션 2: Staging DB** 🌟

이유:
- Docker 설치 부담 없음
- 안전하게 테스트 가능
- 10분이면 완료
- 무료

### 나중에 (다음 주)
**→ 옵션 3: Docker 로컬**

이유:
- 앞으로 계속 쓸 수 있음
- 더 복잡한 마이그레이션에 필수
- 한 번 설정하면 평생 편함

---

## 💬 선택 가이드

### 질문 1: Docker 설치 괜찮아?
- **YES** → 옵션 3 (Docker 로컬) - 최고!
- **NO** → 질문 2로

### 질문 2: 10분 시간 있어?
- **YES** → 옵션 2 (Staging DB) - 추천!
- **NO** → 옵션 1 (조심히 직접)

---

## 📝 Docker Desktop 무료 조건

✅ **무료인 경우:**
- 개인 사용
- 교육 목적
- 오픈소스 프로젝트
- 소규모 회사 (<250명, <$10M 매출)

❌ **유료인 경우:**
- 대기업 ($9/월)

**→ 당신은 무료!**

---

## 🖥️ 시스템 정보

Windows + Intel i7 = **AMD64** ✅
- Docker Desktop 완벽 지원
- Supabase CLI 완벽 지원
- 표준 환경

---

## 🚀 다음 단계

어떤 옵션 선택할래요?

### A. Staging DB (추천)
→ `docs/staging-db-without-docker.md` 보기

### B. Docker 로컬
→ `setup-local-supabase.md` 보기

### C. 조심히 직접
→ `docs/safe-migration-guide.md` 보기
