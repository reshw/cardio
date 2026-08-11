# Vercel Serverless Functions (12개)

Hobby 플랜 한도 = 12개. 현재 정확히 12개 사용 중.

---

## Admin

| 파일 | 엔드포인트 | 메서드 | 설명 |
|------|-----------|--------|------|
| `api/admin/strava-backfill.ts` | `/api/admin/strava-backfill` | POST | 슈퍼어드민 전용. 특정 유저의 Strava 활동 내역을 과거 기간까지 일괄 가져와서 workouts 테이블에 삽입 |
| `api/admin/strava-integrations.ts` | `/api/admin/strava-integrations` | GET / DELETE | 슈퍼어드민 전용. Strava 연동 목록 조회 및 연동 해제 (Strava deauthorize 포함) |

## Auth

| 파일 | 엔드포인트 | 메서드 | 설명 |
|------|-----------|--------|------|
| `api/auth/strava/callback.ts` | `/api/auth/strava/callback` | GET | Strava OAuth 콜백. 인증코드로 access/refresh token 교환 후 user_integrations에 저장 |

## Workout

| 파일 | 엔드포인트 | 메서드 | 설명 |
|------|-----------|--------|------|
| `api/create-workout.ts` | `/api/create-workout` | POST | 운동 기록 생성. workouts 테이블 insert + audit_logs 기록 |
| `api/monthly-snapshot.ts` | `/api/monthly-snapshot` | GET | 클럽별 월간 마일리지 스냅샷 생성. clubs + club_monthly_configs 기반으로 집계 (Vercel Cron 트리거) |

## Email (Resend)

| 파일 | 엔드포인트 | 메서드 | 설명 |
|------|-----------|--------|------|
| `api/send-club-request-email.ts` | `/api/send-club-request-email` | POST | 클럽 가입 신청 시 클럽장에게 알림 메일 발송 |
| `api/send-login-diagnostic.ts` | `/api/send-login-diagnostic` | POST | 로그인 실패 진단 정보 수집 후 관리자 이메일로 발송 |
| `api/send-mileage-alert-email.ts` | `/api/send-mileage-alert-email` | POST | 마일리지 경고 발생 시 해당 유저에게 알림 메일 발송 |

## Sync (FCM)

| 파일 | 엔드포인트 | 메서드 | 설명 |
|------|-----------|--------|------|
| `api/sync/trigger.ts` | `/api/sync/trigger` | POST / GET | Android FCM 푸시 발송. `userId` 있으면 해당 유저 단건, 없으면 전체 android 토큰에 sync 액션 발송 (500개 청크) |

## Upload

| 파일 | 엔드포인트 | 메서드 | 설명 |
|------|-----------|--------|------|
| `api/upload-to-r2.ts` | `/api/upload-to-r2` | POST | 이미지 업로드. sharp로 리사이즈 후 Cloudflare R2에 저장, Supabase에 URL 기록 |

## Strava

| 파일 | 엔드포인트 | 메서드 | 설명 |
|------|-----------|--------|------|
| `api/strava-debug.ts` | `/api/strava-debug` | GET | 개발용. 특정 유저의 Strava 토큰 상태 확인 + 만료 시 자동 갱신 + athlete/activities API 응답 확인 |
| `api/webhooks/strava.ts` | `/api/webhooks/strava` | GET / POST | Strava webhook 수신. GET = 구독 인증, POST = 활동 create/update/delete 이벤트 처리 후 workouts 동기화 |

---

## 공유 모듈 (Function 아님)

| 파일 | 설명 |
|------|------|
| `api/_strava-shared.ts` | Strava 관련 공통 유틸 (STRAVA_TYPE_MAP, getValidToken, generateStravaCard). `_` 접두사로 Vercel이 Function으로 인식하지 않음 |
