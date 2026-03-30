# 🚀 빠른 시작: Supabase Local Development

## TL;DR

```bash
# 1. Docker Desktop 설치 및 실행
# https://www.docker.com/products/docker-desktop/

# 2. Supabase CLI 설치
scoop install supabase

# 3. 초기화
cd D:\dev\cardio
supabase init
supabase login
supabase link --project-ref YOUR_PROJECT_ID

# 4. 프로덕션 스키마 가져오기
supabase db pull

# 5. 로컬 시작
supabase start

# 6. 이제 테스트!
# http://localhost:54323 (Studio)
```

## 📋 체크리스트

- [ ] Docker Desktop 설치 및 실행 중
- [ ] Supabase CLI 설치 (`supabase --version` 동작)
- [ ] `supabase init` 실행 완료
- [ ] `supabase link` 프로젝트 연결
- [ ] `supabase db pull` 스키마 가져오기
- [ ] `supabase start` 로컬 DB 시작
- [ ] http://localhost:54323 접속 확인

## 🎯 지금 하고 싶은 것: 마이그레이션 테스트

### 방법 1: 수동 (간단)

```bash
# 1. 로컬 Supabase 시작
supabase start

# 2. Studio에서 직접 SQL 실행
# http://localhost:54323 → SQL Editor
# sql/migrate_workout_subtypes_SAFE.sql 붙여넣고 실행

# 3. 앱 테스트
npm run dev
# 계단 운동 등록해보기!
```

### 방법 2: 마이그레이션 파일 (권장)

```bash
# 1. 마이그레이션 파일 생성
supabase migration new add_subtype_units

# 2. 파일 편집
# supabase/migrations/20260330XXXXXX_add_subtype_units.sql
# ← sql/migrate_workout_subtypes_SAFE.sql 내용 복사

# 3. 적용
supabase db reset

# 4. 테스트
npm run dev

# 5. 문제 없으면 프로덕션 적용
supabase db push
```

## 🔄 Git + Supabase 워크플로우

```
로컬 개발
  ↓
supabase db reset (로컬 테스트)
  ↓
git commit (코드 + 마이그레이션)
  ↓
git push origin dev
  ↓
supabase db push (프로덕션 적용)
```

## 💡 주요 명령어

```bash
# 시작/종료
supabase start              # 로컬 DB 시작
supabase stop               # 로컬 DB 종료
supabase status             # 상태 확인

# 동기화
supabase db pull            # 프로덕션 → 로컬 (git pull)
supabase db push            # 로컬 → 프로덕션 (git push)

# 마이그레이션
supabase migration new NAME # 새 마이그레이션
supabase migration list     # 마이그레이션 목록
supabase db reset           # 로컬 DB 재설정 (모든 마이그레이션 재적용)

# 백업/복원
supabase db dump -f backup.sql
```

## ⚡ 장점

| 기능 | 기존 | Supabase CLI |
|------|------|--------------|
| 테스트 환경 | ❌ 없음 | ✅ 로컬 Docker |
| 실수 시 | 🔴 프로덕션 망가짐 | 🟢 로컬만 초기화 |
| 롤백 | 🔴 수동 | 🟢 자동 |
| 팀 협업 | 🔴 SQL 파일 공유 | 🟢 Git |
| 히스토리 | ❌ 없음 | ✅ migrations/ |
| CI/CD | ❌ 불가 | ✅ 가능 |

## 📦 설치 크기

- Docker Desktop: ~500MB
- Supabase CLI: ~50MB
- 로컬 DB 이미지: ~1.5GB (첫 실행 시)

**총합: ~2GB**

## ⏱️ 시간

- Docker 설치: 5분
- CLI 설치: 1분
- 초기 설정: 2분
- 첫 실행 (이미지 다운로드): 5분

**총합: ~15분**

## 🎯 추천

**지금 상황:**
1. ✅ **Docker + Supabase CLI 설치** (15분)
2. ✅ **로컬에서 마이그레이션 테스트** (안전)
3. ✅ **문제 없으면 프로덕션 적용** (`supabase db push`)

**왜?**
- 한 번만 설정하면 평생 편함
- 이후 모든 마이그레이션이 안전해짐
- Git처럼 버전 관리 가능
- 팀원이 생기면 협업 가능

## 🆘 도움이 필요하면

1. Docker 설치 문제 → Docker Desktop 재시작
2. 포트 충돌 → `supabase/config.toml` 포트 변경
3. 마이그레이션 오류 → `supabase db reset`

## 📚 다음 단계

설치 후:
1. `supabase start` → 로컬 DB 시작
2. http://localhost:54323 → Studio 열림
3. SQL 직접 실행해서 테스트
4. 앱 실행해서 확인
5. 문제 없으면 `supabase db push`

---

**시작할까요?** Docker Desktop 설치부터 할게요.
