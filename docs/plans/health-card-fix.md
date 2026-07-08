# Apple Health / Health Connect 카드 미생성 + 상세 표시 개선

날짜: 2026-07-08 / 상태: 완료 — pg_net 활성화(적용됨), 프론트 수정(dev 커밋), iOS 요청 발송

확정 사항: 기존 미생성 레코드 백필은 하지 않음 (새 기록부터만). d2067f03 은 진단 중 카드 생성됨.

## 진단 결과

### 1. 카드 자동생성 안 됨 — 원인: 프로덕션 DB에 pg_net 확장 미설치

- Vercel 함수(`/api/webhooks/workout-inserted`)는 **정상** — 수동 호출 시 카드 생성 + proof_image 업데이트 확인됨 (d2067f03 레코드로 검증, 카드 생성됨)
- Vercel 환경변수(R2, WEBHOOK_SECRET 등) 모두 설정됨
- 트리거 `on_workout_inserted` 와 함수 `handle_workout_inserted` 는 프로덕션 DB에 **존재하고 활성 상태**
- 그러나 **`pg_net` 확장이 미설치** → 트리거 안의 `net.http_post` 가 매번 실패 → `exception when others then null` 로 조용히 무시됨
- 검증: 테스트 INSERT 후 30초 대기해도 카드 미생성 (수동 웹훅 호출은 ~2초 만에 생성)

**수정**: `create extension if not exists pg_net;` 프로덕션 적용 → 테스트 INSERT로 파이프라인 재검증

### 2. 기존 미생성 레코드 백필

proof_image 가 null 인 apple_health / google_health 레코드 (~12건, 사진 업로드된 건 제외)
→ 웹훅 엔드포인트 수동 호출로 카드 일괄 생성

### 3. 상세 화면에 페이스 안 나옴 — 표시 로직이 strava 전용

DB 데이터는 정상 (elapsed_seconds, value, calories 존재). 문제는 프론트 렌더 조건:

- `src/pages/WorkoutDetail.tsx` (기록 리스트 탭 상세): 평균속도 표시가 `source === 'strava' && average_speed` 조건 — apple_health 는 average_speed 가 null 이라 페이스 미표시
- `src/components/WorkoutFeedCard.tsx` (클럽 오늘의운동 상세 모달): `formatStravaSpeed()` 가 `moving_seconds` 만 사용 + `source === 'strava'` 게이트 — apple_health 는 moving_seconds 가 대부분 null (elapsed_seconds 만 있음)

**수정** (양쪽 동일 패턴):
- 시간: `moving_seconds ?? elapsed_seconds` 폴백 (라벨: strava 는 "이동 시간", 그 외 "운동 시간")
- 페이스/속도: source 게이트 제거, `moving_seconds ?? elapsed_seconds` + value 로 계산
  - 달리기/걷기: `n'nn"/km`, 수영: `n'nn"/100m`, 사이클/로잉: `km/h` (average_speed 있으면 우선, 없으면 계산)
- 심박: 이미 값이 있으면 표시되는 구조 — apple_health 는 DB 값 자체가 null (4번 참조)

### 4. apple_health 평균심박 null — iOS 앱이 안 보냄

google_health(Android)는 average_heartrate/max_heartrate/steps 전송 중.
iOS 앱은 elapsed_seconds, calories, device_name 정도만 전송.
→ **cardio-app 에이전트에 메시지**로 average_heartrate, max_heartrate, moving_seconds, (가능하면 GPS route) 추가 전송 요청. 웹/카드 로직은 값이 오면 자동 반영되는 구조라 추가 작업 불필요.

### 참고: 카드 생성 로직(_workout-card.ts)은 페이스 이미 지원

distance/moving(elapsed 폴백) 계산으로 달리기 PACE, 수영 PACE, 심박/칼로리 스탯 포함.
pg_net 만 켜면 카드에는 운동시간·페이스·칼로리가 정상 포함됨.

## 작업 순서

1. pg_net 확장 활성화 (프로덕션) + 테스트 INSERT 재검증
2. 기존 미생성 레코드 카드 백필
3. WorkoutDetail.tsx / WorkoutFeedCard.tsx 페이스·시간 표시 수정 → 빌드 → dev 커밋
4. cardio-app(iOS)에 심박 필드 요청 메시지 (초안 승인 후 발송)
