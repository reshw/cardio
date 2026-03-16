# User Data Migration Guide

test01 사용자의 데이터를 카카오 로그인한 사용자로 옮기는 가이드입니다.

## 방법 1: TypeScript 도구 사용 (권장)

### 1단계: 필요한 패키지 설치

```bash
npm install -D tsx
```

### 2단계: 마이그레이션 도구 실행

```bash
npx tsx migrate-user-data.ts
```

### 3단계: 화면 안내에 따라 진행

1. 모든 사용자 목록이 표시됩니다
2. SOURCE user ID (test01 사용자 ID) 입력
3. TARGET user ID (카카오 사용자 ID) 입력
4. 확인 후 'yes' 입력
5. 마이그레이션 완료!

### 예시 출력

```
====================================
🔧 User Data Migration Tool
====================================

📋 Fetching all users...

Available users:
----------------------------------------
tester01                  | 테스터          | local    | 15 logs | ID: xxx-xxx-xxx
kakao_1234567890          | 홍길동          | kakao    | 0 logs  | ID: yyy-yyy-yyy
----------------------------------------

Enter SOURCE user ID (데이터를 옮길 원본 사용자 ID): xxx-xxx-xxx

✅ Source user found:
   Username: tester01
   Display Name: 테스터
   Provider: local
   Workout Logs: 15

Enter TARGET user ID (데이터를 받을 대상 사용자 ID): yyy-yyy-yyy

✅ Target user found:
   Username: kakao_1234567890
   Display Name: 홍길동
   Provider: kakao
   Current Workout Logs: 0

⚠️  WARNING: This will transfer ALL workout logs!
   FROM: tester01 (15 logs)
   TO:   kakao_1234567890 (currently 0 logs)
   TOTAL after migration: 15 logs

Are you sure you want to proceed? (yes/no): yes

🔄 Starting migration...
✅ Migration completed successfully!

📊 Migration Results:
   tester01: 15 → 0 logs
   kakao_1234567890: 0 → 15 logs

💡 The source user now has 0 workout logs.
Do you want to DELETE the source user? (yes/no): yes
✅ Source user deleted successfully!

✨ All done!
```

## 방법 2: Supabase SQL Editor에서 직접 실행

### 1단계: 사용자 ID 확인

Supabase Dashboard → SQL Editor에서 실행:

```sql
SELECT
    id,
    username,
    display_name,
    provider,
    kakao_id
FROM users
ORDER BY created_at DESC;
```

### 2단계: workout_logs 개수 확인

```sql
SELECT
    u.username,
    u.display_name,
    COUNT(wl.id) as log_count
FROM users u
LEFT JOIN workout_logs wl ON wl.user_id = u.id
GROUP BY u.id, u.username, u.display_name
ORDER BY log_count DESC;
```

### 3단계: 마이그레이션 실행

아래 SQL에서 UUID를 실제 값으로 변경하고 실행:

```sql
-- 1. workout_logs 이전
UPDATE workout_logs
SET user_id = 'YOUR_KAKAO_USER_UUID'
WHERE user_id = 'YOUR_TEST01_USER_UUID';

-- 2. user_profiles 이전 (있다면)
UPDATE user_profiles
SET user_id = 'YOUR_KAKAO_USER_UUID'
WHERE user_id = 'YOUR_TEST01_USER_UUID';

-- 3. 결과 확인
SELECT
    u.username,
    COUNT(wl.id) as log_count
FROM users u
LEFT JOIN workout_logs wl ON wl.user_id = u.id
WHERE u.id IN ('YOUR_TEST01_USER_UUID', 'YOUR_KAKAO_USER_UUID')
GROUP BY u.id, u.username;

-- 4. (선택) test01 사용자 삭제
-- DELETE FROM users WHERE id = 'YOUR_TEST01_USER_UUID';
```

## 방법 3: 간편 스크립트 (package.json)

### package.json에 스크립트 추가

```json
{
  "scripts": {
    "migrate": "tsx migrate-user-data.ts"
  }
}
```

### 실행

```bash
npm run migrate
```

## 주의사항

1. **백업**: 마이그레이션 전에 Supabase에서 데이터 백업 권장
2. **테스트**: 가능하면 테스트 환경에서 먼저 실행
3. **복구 불가**: 마이그레이션 후 원본 사용자를 삭제하면 복구 불가능
4. **관계 유지**: workouts는 workout_log_id로 자동으로 연결되므로 별도 작업 불필요

## 문제 해결

### "Invalid UUID format" 오류
- UUID 형식이 올바른지 확인 (예: `123e4567-e89b-12d3-a456-426614174000`)
- 앞뒤 공백 제거

### "User not found" 오류
- 사용자 ID가 데이터베이스에 존재하는지 확인
- Supabase Dashboard에서 직접 조회

### RLS (Row Level Security) 오류
- Supabase service role key를 사용하거나
- RLS 정책을 일시적으로 비활성화 후 실행

## 완료 후 확인사항

✅ 카카오 사용자의 workout_logs 개수 확인
✅ 앱에서 로그인 후 데이터 정상 표시 확인
✅ test01 사용자 로그 개수 0개 확인
✅ (선택) test01 사용자 삭제
