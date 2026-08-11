# 웹서버 작업 협업 요청서

## 배경

Android 앱이 Health Connect (삼성헬스 / 가민 / 갤럭시워치 등) 데이터를 Supabase로 업로드하는 구조.
앱은 백그라운드에서 하루 5회 자동 sync하지만, 웹 접속 시점에 최신 데이터 반영을 위해
서버에서 기기를 깨워 즉시 sync를 트리거하는 기능이 필요함.

---

## 전체 흐름

```
[웹 로그인 / 운영자 버튼]
        ↓
[Vercel API → Firebase Admin SDK]
        ↓
[FCM data message → 해당 기기 (Doze 우회)]
        ↓
[Android 앱 백그라운드 수신 → Health Connect 읽기 → Supabase 업로드]
```

---

## Android 앱 측 준비 완료 사항 (참고)

- 앱 실행 시 FCM 토큰 발급 → Supabase `device_tokens` 테이블에 upsert
- FCM data message 수신 시 즉시 SyncWorker expedited 실행
- WorkManager fallback: 하루 5회 (288분 간격)

---

## 서버 측 작업 목록

### 1. Supabase 테이블 추가

```sql
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  fcm_token text not null,
  platform text default 'android',
  club_id uuid references clubs(id),
  updated_at timestamptz default now(),
  unique (user_id, platform)
);
```

> **주의**: `user_id`는 `auth.users.id`(Supabase Auth UUID)가 아니라
> `public.users.id` 참조. Android 앱이 저장하는 ID가 public.users 기준임.

- upsert 방식으로 토큰 갱신 (`resolution=merge-duplicates`)
- `club_id`: 운영자 전체 sync 시 클럽 단위 필터용

---

### 2. Firebase Admin SDK 셋업

서비스 계정 파일 (`noti-svc.json`) 이미 준비되어 있음.
해당 파일에서 아래 3개 값을 Vercel 환경변수에 등록:

| 환경변수 | 파일 내 필드 |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` (줄바꿈 `\n` 그대로 문자열로) |

```bash
npm install firebase-admin
```

Firebase Admin 초기화 (공통 유틸로 분리 권장):

```ts
// lib/firebaseAdmin.ts
import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export default admin
```

---

### 3. Vercel API — 웹 로그인 시 FCM 트리거

`POST /api/sync/trigger-user`

웹에서 로그인 완료 후 호출. 해당 유저의 Android 기기에 FCM 발송.

```ts
// /api/sync/trigger-user.ts
import admin from '@/lib/firebaseAdmin'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(req, res) {
  const { userId } = req.body  // public.users.id

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', userId)
    .eq('platform', 'android')

  if (!tokens?.length) return res.status(200).json({ skipped: true })

  await admin.messaging().sendEachForMulticast({
    tokens: tokens.map(t => t.fcm_token),
    data: { action: 'sync' },
    android: { priority: 'high' },
  })

  res.status(200).json({ sent: tokens.length })
}
```

---

### 4. Vercel API — 운영자 전체 동기화 버튼

`POST /api/sync/trigger-club`

운영자 페이지에서 "전체 동기화 요청" 클릭 시 해당 클럽 전체 기기에 FCM 발송.

```ts
// /api/sync/trigger-club.ts
import admin from '@/lib/firebaseAdmin'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )
}

export default async function handler(req, res) {
  const { clubId } = req.body
  // TODO: 운영자 권한 확인

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('fcm_token')
    .eq('club_id', clubId)
    .eq('platform', 'android')

  if (!tokens?.length) return res.status(200).json({ skipped: true })

  const batches = chunk(tokens.map(t => t.fcm_token), 500)
  for (const batch of batches) {
    await admin.messaging().sendEachForMulticast({
      tokens: batch,
      data: { action: 'sync' },
      android: { priority: 'high' },
    })
  }

  res.status(200).json({ sent: tokens.length })
}
```

---

### 5. 웹앱 UI — 운영자 버튼

운영자 대시보드에 버튼 1개 추가:

```
[ 전체 기기 동기화 요청 ]
```

- 클릭 시 `/api/sync/trigger-club` 호출
- 응답 후 "요청 완료 (N대)" 토스트 표시
- 30~60초 후 페이지 새로고침 시 최신 데이터 반영

---

## 참고 — FCM data message 형식

```json
{
  "data": { "action": "sync" },
  "android": { "priority": "HIGH" }
}
```

- `notification` 필드 없이 `data`만 사용 → 앱이 조용히 백그라운드 수신 후 처리
- `priority: HIGH` → Android Doze 모드 우회

---

## 작업 우선순위

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | `device_tokens` 테이블 생성 | Android 앱과 연동 전제 |
| 2 | `lib/firebaseAdmin.ts` + Vercel 환경변수 등록 | `noti-svc.json` 참고 |
| 3 | `/api/sync/trigger-user` 구현 | 로그인 후 자동 트리거 |
| 4 | `/api/sync/trigger-club` 구현 | 운영자 수동 트리거 |
| 5 | 운영자 UI 버튼 추가 | |
