# Android 앱 작업 요청 — Health Connect Sync 연동

## 웹서버 처리 완료 내역

### 1. `device_tokens` 테이블 생성 (Supabase)

```sql
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  fcm_token text not null,
  platform text default 'android',
  updated_at timestamptz default now(),
  unique (user_id, platform)
);
```

- `user_id`: `public.users.id` 기준 (auth.users가 아님)
- RLS: 본인 토큰만 upsert 가능

---

### 2. `/api/sync/trigger-user` API 구현 (Vercel)

웹 접속 시 자동 호출됨. 해당 유저의 `device_tokens`를 조회해 FCM data message 발송.

```json
{
  "data": { "action": "sync" },
  "android": { "priority": "HIGH" }
}
```

- `notification` 없음 → 조용한 백그라운드 수신
- `priority: HIGH` → Doze 모드 우회

---

### 3. `workouts` 테이블 unique constraint 추가

```sql
unique (user_id, source_activity_id)
```

- 다중 기기 동시 sync 시 중복 삽입 DB 레벨 차단
- `source_activity_id` null(수동 입력)은 제약 대상 아님

---

## Android 앱 측 구현 필요 사항

### [필수 1] FCM 토큰 → `device_tokens` upsert

앱 시작 시 또는 FCM 토큰 갱신 시 Supabase에 저장.

```kotlin
// FirebaseMessaging.getInstance().token 콜백 또는 onNewToken() 내부
val userId = /* public.users.id (Supabase Auth로 로그인 후 가져온 값) */
val fcmToken = /* FirebaseMessaging token */

supabase.from("device_tokens").upsert(
    mapOf(
        "user_id" to userId,
        "fcm_token" to fcmToken,
        "platform" to "android"
    ),
    onConflict = "user_id,platform"
)
```

> **주의**: `user_id`는 `auth.users.id`(UUID)가 아니라 `public.users.id`여야 함.
> 로그인 후 `public.users` 테이블에서 `auth_id = auth.uid()` 조건으로 조회한 `id` 사용.

---

### [필수 2] FCM data message 수신 → SyncWorker expedited 실행

```kotlin
// MyFirebaseMessagingService.onMessageReceived()
override fun onMessageReceived(message: RemoteMessage) {
    if (message.data["action"] == "sync") {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()
        WorkManager.getInstance(applicationContext).enqueue(request)
    }
}
```

---

### [필수 3] workout 저장 시 `source_activity_id` 포함

Health Connect에서 읽은 각 운동 레코드의 메타데이터 ID를 `source_activity_id`로 저장해야 중복 방지 constraint가 동작함.

```kotlin
// Supabase workouts insert 시
mapOf(
    "user_id" to userId,
    "source_activity_id" to record.metadata.id,  // Health Connect metadata.id
    // ... 나머지 필드
)
```

- 동일 레코드를 두 기기가 동시에 insert 시도하면 DB가 하나만 허용, 나머지는 에러 반환
- 앱은 해당 에러를 무시하고 `Result.success()` 처리하면 됨 (사용자 영향 없음)

---

## 전체 흐름 요약

```
[웹 접속]
    ↓
[Vercel API → device_tokens 조회 → FCM 발송]
    ↓
[Android 백그라운드 수신 → SyncWorker expedited 실행]
    ↓
[Health Connect 읽기 → source_activity_id 포함 → Supabase insert]
    ↓
[중복 시 DB constraint가 차단, 앱은 무시]
```
