# DB 동기화: Prod → Staging

## 주문 프롬프트

> prod DB의 public 스키마와 데이터를 staging DB에 동기화해줘. staging 기존 데이터는 초기화해도 돼.

---

## 환경 정보 (Claude Code 참고용)

- **pg_dump / pg_restore 경로**: `C:\Program Files\PostgreSQL\17\bin\` (bash에서는 `/c/Program Files/PostgreSQL/17/bin/`)
- **Supabase CLI**: 설치 없이 `npx supabase`로 실행 (Node.js 필요)
- **작업 디렉토리**: `D:\dev\cardio` (bash에서는 `/d/dev/cardio`)

### 연결 정보

비밀번호는 `.env`에서 읽을 것 (staging 비밀번호는 주석처리되어 있으므로 주석 제거 후 확인)

| | Prod | Staging |
|---|---|---|
| 프로젝트 ref | `fqtqvqkcftepohbiliyi` | `wgnhqlfbabftkwzwidsv` |
| Pooler 호스트 | `aws-1-ap-southeast-1.pooler.supabase.com` | `aws-1-ap-south-1.pooler.supabase.com` |
| 비밀번호 키 | `SUPABASE_PROD_DB_PASSWORD` | `SUPABASE_STAGING_DB_PASSWORD` |

---

## 실행 절차

```bash
# 1. prod에서 public 스키마 + 데이터 dump
"/c/Program Files/PostgreSQL/17/bin/pg_dump.exe" -Fc -n public \
  -f /d/dev/cardio/prod_public.dump \
  "postgresql://postgres.fqtqvqkcftepohbiliyi:{PROD_PW}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

# 2. staging에 복원 (기존 데이터 초기화)
"/c/Program Files/PostgreSQL/17/bin/pg_restore.exe" --clean --if-exists --no-owner --no-privileges -n public \
  -d "postgresql://postgres.wgnhqlfbabftkwzwidsv:{STAGING_PW}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" \
  /d/dev/cardio/prod_public.dump
```

> **주의**: auth, storage, realtime 등 Supabase 시스템 스키마는 권한 문제로 복원 불가. public 스키마만 대상으로 할 것.
