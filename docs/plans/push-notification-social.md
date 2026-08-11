# 좋아요·댓글 푸시 알림 + 딥링크 — 구현 계획

`and`(Android)가 제안한 계약(cardio-comms #58)에 대한 web(서버) 쪽 실행 계획.
app(iOS) 회신은 아직 없음 — 회신 오기 전까지 진행 가능한 부분만 먼저 확정한다.

## 왜 이 아키텍처인가

`and`는 "Supabase DB Webhook → Edge Function"을 제안했지만, 이 저장소엔 이미
**정확히 같은 목적의 패턴이 살아서 돌고 있다**: [api/webhooks/workout-inserted.ts](../../api/webhooks/workout-inserted.ts)가
`workouts` 테이블 INSERT/UPDATE에 걸린 Supabase DB Webhook을 받아 Vercel 서버리스
함수에서 처리하고, `SUPABASE_WEBHOOK_SECRET` Bearer 토큰으로 인증한다.

Edge Function(Deno, Supabase 쪽 배포)을 새로 들이는 대신 **같은 패턴을 재사용**한다.
- 새 배포 파이프라인이 안 늘어남 (Vercel 하나로 통일)
- `api/_firebase-admin.ts`에 firebase-admin 초기화가 이미 있어 FCM 발송도 재사용 가능
- 인증 방식(webhook secret)도 기존 것 그대로 사용 — 새 시크릿 불필요

## 이미 갖춰진 것 (재사용)

| 항목 | 위치 | 비고 |
|---|---|---|
| Firebase Admin 초기화 | [api/_firebase-admin.ts](../../api/_firebase-admin.ts) | `FIREBASE_PROJECT_ID`/`CLIENT_EMAIL`/`PRIVATE_KEY` — **Vercel 프로덕션에 이미 설정돼 있음** (`/api/sync/trigger`가 이미 이 값으로 라이브 동작 중, 실측 확인함) |
| DB Webhook → Vercel 패턴 | [api/webhooks/workout-inserted.ts](../../api/webhooks/workout-inserted.ts) | 그대로 복제해서 씀 |
| `device_tokens` 테이블 | `user_id, fcm_token, platform` | Android는 upsert 중, iOS는 app 회신 대기 |
| `notifications` 테이블 | `id/user_id/actor_id/workout_id/club_id/type/comment_text/comment_id/read/created_at` | DB 트리거(`create_like_notification`/`create_comment_notification`)가 이미 INSERT하고 있음 — 종 아이콘 알림은 그대로 두고, 이 INSERT에 웹훅만 추가로 붙인다 |
| 웹 상세 라우트 | `/workout/:id` ([App.tsx:81](../../src/App.tsx)) | 딥링크 목적지 |

→ **`and`의 질문 2번(Firebase Admin 자격증명 유무)에 대한 답: 이미 있음.** 새로 발급할 필요 없음.

## 새로 만들 것

### 1. `api/webhooks/notification-inserted.ts`

`workout-inserted.ts`와 동일 구조.

```
1. Authorization: Bearer <SUPABASE_WEBHOOK_SECRET> 검증
2. type !== 'INSERT' || table !== 'notifications' → skip
3. record.user_id === record.actor_id → skip (본인 알림 제외, and 요청 4번)
4. actor 이름 조회 (public.users.display_name), 필요시 workout 요약(category/value/unit) 조회
   → title/body 서버에서 완성 (and 요청 3번 — 앱이 로그아웃 상태일 수도 있어 재조회 못 함)
5. path 조립:
   - type='like' | 'comment' → `/workout/${record.workout_id}`
6. device_tokens 조회: user_id = record.user_id (platform 필터 없음 — android/ios 전부)
7. firebase-admin sendEachForMulticast:
   data: { action:'social', type, title, body, path, notification_id: record.id }
   android: { priority: 'high' }
   apns: { payload: { aps: { alert: { title, body }, sound: 'default' } } }
8. 실패해도 200 반환 (webhook 재시도 폭주 방지, workout-inserted.ts와 동일 관례)
```

### 2. Supabase DB Webhook 등록 (대시보드 수동 설정, 1회)

- Database → Webhooks → New webhook
- Table: `notifications`, Event: `INSERT`
- URL: `https://cardio.scnd.kr/api/webhooks/notification-inserted`
- Header: `Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>` (기존 값 재사용)

이건 코드가 아니라 대시보드 클릭 작업이라 배포와 별개로 진행자가 직접 눌러야 한다.

## `and` 질문에 대한 이번 계획의 답

| # | 질문 | 답 |
|---|---|---|
| 1 | 발송 트리거 위치 | Vercel DB Webhook 함수 (Edge Function 아님) — 기존 패턴 재사용 |
| 2 | Firebase Admin 자격증명 | 이미 있음, 새로 발급 불필요 |
| 3 | title/body 서버 완성 | 동의, 웹훅 핸들러에서 조립 |
| 4 | self-push 제외 | 동의, `user_id === actor_id` 체크로 처리 |
| 5 | iOS 토큰 여부 | web은 답 불가 — app 회신 대기 |
| 6 | 알림 목록 페이지 path | **보류 — 아래 참고** |

### 6번 보류 사유

종 아이콘은 페이지가 아니라 [Header.tsx](../../src/components/Header.tsx)의 인앱 드롭다운이다.
전용 `/notifications` 라우트가 없어서 "여러 건 묶음 알림"용 path를 당장 줄 수 없다.
좋아요/댓글 단건은 `/workout/:id`로 충분하니 **1단계는 단건 딥링크만 구현**하고,
묶음 알림이 필요해지면 전용 라우트를 새로 파는 걸 2단계로 미루는 걸 제안한다.

## 막힌 것 — app(iOS) 회신 대기

- `device_tokens`에 iOS 토큰이 실제로 쌓이고 있는지 확인 안 됨 (5번)
- iOS가 `path`를 절대 URL 방어 없이 그대로 여는지, `and`처럼 방어 로직을 넣을지 확인 안 됨

**1단계(Android만 우선 발송)는 app 회신과 무관하게 바로 만들 수 있다.**
`device_tokens` 쿼리에 platform 필터를 안 걸어서 코드를 짜 두면, iOS 토큰이 나중에
들어오기 시작해도 코드 변경 없이 자동으로 같이 발송된다 — app 회신을 막연히
기다릴 필요 없이 지금 만들어도 무방하다.

## 진행하며 발견한 별개 버그 (이번 계획과 무관, 별도 처리 필요)

[vercel.json](../../vercel.json)의 cron 5개가 `/api/sync/trigger-all`을 매일 5번 호출하는데,
**실제 파일명은 `api/sync/trigger.ts`다.** `trigger-all`은 프로덕션에서 404 확인함
(`curl -X POST https://cardio.scnd.kr/api/sync/trigger-all` → 404).
즉 자동 헬스 동기화 크론이 하루 5번 전부 조용히 실패하고 있다.
경로를 `/api/sync/trigger`로 고치면 바로 살아난다 — 이건 이번 작업과 별개로 지금 같이 고칠지 확인 필요.

## 다음 액션

1. `api/webhooks/notification-inserted.ts` 작성 (Android 우선, iOS 자동 포함 구조로)
2. Supabase DB Webhook 대시보드 등록 (수동)
3. cron 경로 버그 수정 여부 확인
4. `and`에게 위 표로 회신, app 회신 도착 시 iOS 세부사항 반영
