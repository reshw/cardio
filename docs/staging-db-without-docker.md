# Docker 없이 Staging DB 만들기

## 🎯 개념

```
Production DB (Supabase 프로젝트 1) ← 실제 사용자
Staging DB   (Supabase 프로젝트 2) ← 테스트용 (무료!)
```

Docker 없이 Supabase 무료 프로젝트를 하나 더 만들어서 테스트 환경으로 사용!

## ✅ 장점

- ✅ Docker 설치 불필요
- ✅ 디스크 공간 절약 (Docker 2GB vs 0GB)
- ✅ 완전히 독립적인 환경
- ✅ 실제 프로덕션과 동일한 환경
- ✅ 무료 (Supabase 무료 플랜 프로젝트 2개까지)

## ❌ 단점

- ❌ 로컬이 아니라 인터넷 연결 필요
- ❌ 속도가 로컬보다 느림
- ❌ Supabase CLI의 일부 기능 제한

## 🚀 설정 (10분)

### Step 1: Staging 프로젝트 생성

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard

2. **새 프로젝트 생성**
   - "New Project" 클릭
   - Organization: 기존과 동일
   - Name: `cardio-staging`
   - Database Password: 안전한 비밀번호 (저장!)
   - Region: Southeast Asia (Singapore) - 프로덕션과 동일
   - Pricing Plan: **Free** 선택

3. **프로젝트 생성 대기** (2분)

### Step 2: 스키마 복제

#### 옵션 A: Supabase CLI 사용 (추천)

```bash
# Supabase CLI만 설치 (Docker 불필요)
scoop install supabase

# 프로덕션 스키마 덤프
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" > schema.sql

# Staging에 적용
psql -h db.[STAGING-PROJECT-REF].supabase.co \
     -U postgres \
     -d postgres \
     -f schema.sql
```

#### 옵션 B: 수동 복사 (간단)

```bash
# 1. 프로덕션 SQL 에디터에서 실행
# 모든 테이블 생성 스크립트를 복사

# 2. Staging SQL 에디터에 붙여넣기
# sql/create_* 파일들 실행
```

### Step 3: 환경변수 설정

**.env.staging** 생성:
```env
VITE_SUPABASE_URL=https://[STAGING-PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... # Staging 프로젝트의 anon key

# R2 설정도 동일하게 (또는 별도 버킷 사용)
R2_ACCOUNT_ID=f333c2cae710ec01c945bb89ea0bb7d8
R2_ACCESS_KEY_ID=07f8b077120f187d6d23bba92d86e49b
R2_SECRET_ACCESS_KEY=1feccdce52784013d7e911068b77fd2357e7c9e4c54d6fa4e873a95d7c9a4c75
R2_BUCKET_NAME=cardio-staging  # 별도 버킷 (선택사항)
R2_PUBLIC_URL=https://img-staging.scnd.kr
```

**.env** (프로덕션, 기존):
```env
VITE_SUPABASE_URL=https://[PROD-PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Step 4: npm 스크립트 추가

**package.json**:
```json
{
  "scripts": {
    "dev": "vite",
    "dev:staging": "vite --mode staging",
    "build:staging": "vite build --mode staging",
    "build:production": "vite build --mode production"
  }
}
```

## 🔄 마이그레이션 워크플로우

### 1. Staging에서 테스트

```bash
# 1. Staging DB 접속
# https://supabase.com/dashboard/project/[STAGING-REF]
# → SQL Editor

# 2. 마이그레이션 SQL 실행
# sql/migrate_workout_subtypes_SAFE.sql 붙여넣기
# 한 블록씩 실행

# 3. 앱 테스트
npm run dev:staging
# 계단 운동 등록 → 시간/층수 선택 확인!
```

### 2. 프로덕션 적용

```bash
# 문제 없으면 프로덕션 SQL 에디터에서 동일하게 실행
```

## 📊 비교

| 방법 | 설치 | 디스크 | 속도 | 비용 | 추천 |
|------|------|--------|------|------|------|
| **Docker 로컬** | Docker | 2GB | 빠름 | 무료 | ⭐⭐⭐⭐⭐ |
| **Staging DB** | CLI만 | 0GB | 보통 | 무료 | ⭐⭐⭐⭐ |
| 프로덕션 직접 | 없음 | 0GB | 빠름 | 무료 | ⭐ (위험) |

## 💡 Supabase CLI 최소 사용

Docker 없이 Supabase CLI만 사용:

```bash
# CLI만 설치 (50MB)
scoop install supabase

# 프로젝트 링크 (로컬 DB 시작 안함)
supabase link --project-ref [STAGING-REF]

# 마이그레이션 파일 생성
supabase migration new add_subtype_units

# 원격 Staging DB에 적용
supabase db push --db-url "postgresql://..."
```

## 🎯 권장 순서

### 당장 (5분)
1. Supabase Dashboard에서 Staging 프로젝트 생성
2. `.env.staging` 파일 생성
3. Staging SQL 에디터에서 스키마 복사

### 이번 주 (선택)
1. Supabase CLI 설치 (Docker 없이)
2. 마이그레이션 파일로 관리

### 나중에 (선택)
1. Docker Desktop 설치
2. 완전한 로컬 개발 환경

## 🆘 트러블슈팅

### 스키마 복제가 너무 복잡해요
→ 중요한 테이블만 수동 복사
→ 또는 백업 SQL 파일 사용

### Staging DB가 프로덕션과 달라져요
→ 주기적으로 프로덕션 스키마 덤프 후 Staging 재생성

### 테스트 데이터가 필요해요
→ `sql/seed_staging.sql` 파일 만들어서 더미 데이터 추가

## 📝 체크리스트

Staging DB 구축:
- [ ] Supabase에서 새 프로젝트 생성 (cardio-staging)
- [ ] `.env.staging` 파일 생성
- [ ] 스키마 복제 (수동 or CLI)
- [ ] `npm run dev:staging` 동작 확인
- [ ] 마이그레이션 테스트

## 🎉 결론

**Docker 부담스럽다면:**
1. ✅ Supabase 무료 프로젝트 하나 더 만들기 (Staging)
2. ✅ `.env.staging` 설정
3. ✅ Staging에서 마이그레이션 테스트
4. ✅ 문제 없으면 프로덕션 적용

**나중에 편해지면:**
- Docker Desktop 설치
- 완전한 로컬 개발 환경 구축
