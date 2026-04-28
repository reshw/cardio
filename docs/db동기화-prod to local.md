# DB 동기화: Prod → 로컬 Docker

## 한 줄 요약

```bash
PROD_PW=2cXpOo0xFG7KsgVq && \
"/c/Program Files/PostgreSQL/17/bin/pg_dump.exe" -Fc -n public \
  -f /d/dev/cardio/prod_public.dump \
  "postgresql://postgres.fqtqvqkcftepohbiliyi:${PROD_PW}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" && \
"/c/Program Files/PostgreSQL/17/bin/pg_restore.exe" --clean --if-exists --no-owner --no-privileges -n public \
  -d "postgresql://postgres:postgres@localhost:54322/postgres" \
  /d/dev/cardio/prod_public.dump
```

## 환경 정보

| 항목 | 값 |
|---|---|
| pg_dump/restore | `C:\Program Files\PostgreSQL\17\bin\` |
| Prod pooler | `aws-1-ap-southeast-1.pooler.supabase.com:5432` |
| Prod project ref | `fqtqvqkcftepohbiliyi` |
| Prod DB 비밀번호 | `.env` → `SUPABASE_PROD_DB_PASSWORD` |
| 로컬 postgres 포트 | `54322` (컨테이너: `supabase_db_cardio`) |
| 로컬 postgres 비밀번호 | `postgres` |

## 주의

- public 스키마만 복원 (auth, storage 등 시스템 스키마는 권한 문제로 불가)
- `--clean --if-exists`: prod 덤프에 있는 테이블은 DROP 후 재생성 → 로컬 데이터 초기화됨
- **로컬에만 있고 prod에 없는 테이블은 삭제되지 않음** (신경 쓰이면 아래 완전 초기화 명령 사용)

## 완전 초기화 후 복원 (로컬 public 스키마 싹 날리고 싶을 때)

```bash
# 1. 로컬 public 스키마 완전 삭제
"/c/Program Files/PostgreSQL/17/bin/psql.exe" "postgresql://postgres:postgres@localhost:54322/postgres" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 2. prod 덤프 복원
PROD_PW=2cXpOo0xFG7KsgVq && \
"/c/Program Files/PostgreSQL/17/bin/pg_dump.exe" -Fc -n public \
  -f /d/dev/cardio/prod_public.dump \
  "postgresql://postgres.fqtqvqkcftepohbiliyi:${PROD_PW}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres" && \
"/c/Program Files/PostgreSQL/17/bin/pg_restore.exe" --no-owner --no-privileges -n public \
  -d "postgresql://postgres:postgres@localhost:54322/postgres" \
  /d/dev/cardio/prod_public.dump
```
