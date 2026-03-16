# Netlify 설정 가이드

## Scheduled Functions 설정

### 1. 환경 변수 추가
Netlify Dashboard → Site settings → Environment variables에 추가:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**중요**:
- `VITE_SUPABASE_URL`은 이미 설정되어 있어야 함
- Service Role Key는 Supabase 프로젝트 설정에서 확인 가능
- 절대 프론트엔드에 노출하면 안됨 (서버 사이드 전용)

### 2. Scheduled Function 설명

**파일**: `netlify/functions/monthly-snapshot.ts`

**실행 주기**: 매월 1일 00:00 (UTC)
- 한국 시간: 매월 1일 09:00

**동작**:
1. 전월의 모든 클럽 마일리지 설정 조회
2. 각 클럽별로 스냅샷 생성
3. `club_monthly_configs` 테이블에 저장

**수동 실행** (테스트용):
```bash
# Netlify CLI로 로컬 테스트
netlify functions:invoke monthly-snapshot
```

**중요**:
- ⚠️ **프로덕션 배포에서만 작동**: Deploy Preview나 브랜치 배포에서는 실행 안됨
- ⚠️ **URL 직접 호출 불가**: 스케줄에 의해서만 자동 실행됨
- ✅ **테스트**: Netlify CLI 사용 필요

### 3. 로그 확인
Netlify Dashboard → Functions → monthly-snapshot → Logs

### 4. 첫 실행
- **프로덕션 배포** 후 자동으로 다음 달 1일에 실행됨
- 급한 경우 Netlify CLI로 수동 실행 가능

## 문제 해결

### Function이 실행 안됨
- 환경 변수 확인 (SUPABASE_SERVICE_ROLE_KEY)
- Function 로그 확인
- 배포 후 첫 실행까지 대기 (다음 달 1일)

### 스냅샷이 없음
- 배치가 아직 안 돌았으면 현재 설정으로 계산됨
- 수동으로 스냅샷 실행 가능

## 참고사항
- ✅ Scheduled Functions는 **무료 플랜에서도 사용 가능**
- 모든 요금제(Free, Personal, Pro, Enterprise)에서 지원됨
- 첫 배포 후 다음 달 1일부터 자동 실행
