# [cardio-and] Health Connect 필드 추가 요청 (카드 자동 생성용)

작성일: 2026-07-03
발신: 웹앱 (cardio) 담당
수신: cardio-and (Android 네이티브) 담당

---

## 배경

웹앱에서 Strava처럼 **Google Health Connect 기반 workout에도 카드 이미지를 자동 생성**하려 합니다. 서버 사이드(Vercel API + Supabase Database Webhook)로 처리하지만, 카드에 표시할 값 중 일부는 네이티브 앱이 채워서 올려줘야 합니다.

Strava 카드는 페이스/속도, **평균 심박**, **이동 시간(pause 제외)**, 거리를 표시합니다. 같은 수준으로 맞추려면 아래 필드가 필요합니다.

---

## 현재 실측 (원격 Supabase workouts 조회 결과)

```
source = 'google_health' 기준
  workout_time         ✅ 시작 시간 채워짐
  elapsed_seconds      ✅ 채워짐
  moving_seconds       ❌ null  ← 필요
  average_speed        ❌ null  ← 서버 계산 가능, 앱은 불필요
  average_heartrate    ✅ 채워짐 (Samsung Health)
  max_heartrate        ✅ 채워짐
  calories             ✅ 채워짐
  steps                ✅ 채워짐
  value + unit         ✅ 거리 채워짐
```

**추가로 채워달라는 것: `moving_seconds` 1개.** (선택적으로 GPS 경로)

---

## 요청 1 (필수): `moving_seconds` 채우기

### 의미
- **실제 활동 시간** (pause/rest 제외).
- 예: 총 세션 30분 중 신호등에서 5분 정지했다면 `elapsed_seconds = 1800`, `moving_seconds = 1500`.
- 이 값이 있어야 카드의 페이스 표시가 정확해짐.

### Health Connect API
`ExerciseSessionRecord.segments: List<ExerciseSegment>` 를 사용합니다.

각 `ExerciseSegment`는 `segmentType` 필드를 갖고, 다음 상수가 pause/rest 계열입니다:
- `ExerciseSegment.EXERCISE_SEGMENT_TYPE_PAUSE`
- `ExerciseSegment.EXERCISE_SEGMENT_TYPE_REST`

### 계산 방식
```kotlin
val elapsedMs = Duration.between(session.startTime, session.endTime).toMillis()

val pausedMs = session.segments
    .filter {
        it.segmentType == ExerciseSegment.EXERCISE_SEGMENT_TYPE_PAUSE ||
        it.segmentType == ExerciseSegment.EXERCISE_SEGMENT_TYPE_REST
    }
    .sumOf { Duration.between(it.startTime, it.endTime).toMillis() }

val movingSeconds = ((elapsedMs - pausedMs) / 1000).toInt()
```

### 폴백
- `segments`가 비어있거나 pause/rest 세그먼트가 하나도 없으면 → `moving_seconds = elapsed_seconds` 로 동일하게 넣어주세요 (null 대신).
- 이유: 웹 서버가 `moving_seconds ?? elapsed_seconds` 폴백 처리하지만, 값이 있으면 null 여부를 분기하는 로직이 사라져서 간단해집니다.

### INSERT 페이로드 변경
현재 `SyncWorker` / `WorkoutInsert` 에서 `elapsed_seconds` 옆에 `moving_seconds` 필드 추가.
```kotlin
val insert = WorkoutInsert(
    // ...
    elapsedSeconds = elapsedSec,
    movingSeconds = movingSec,   // ← 신규
    // ...
)
```

Supabase workouts 테이블에 `moving_seconds int8 null` 컬럼이 **이미 있으므로** 마이그레이션 불필요.

---

## 요청 2 (선택 · Phase 2): GPS 경로 데이터

### 배경
장기적으로 지도 경로가 그려진 카드를 만들고 싶습니다. 지금 당장은 아니지만, 나중을 위해 미리 저장해두면 좋습니다.

### Health Connect API
`ExerciseSessionRecord.route: ExerciseRoute?` — Samsung Health가 GPS 기록을 켠 세션에 한해 존재.

`ExerciseRoute.route: List<ExerciseRoute.Location>` 각 요소는:
- `time: Instant`
- `latitude: Double`
- `longitude: Double`
- `altitude: Length?`

### 저장 방식
- 아직 웹 서버에 `workouts.route` 컬럼이 **없습니다.** 저장 컬럼 스키마는 웹 서버 담당(우리 쪽)이 나중에 마이그레이션 추가 예정.
- 이번엔 코드 준비만 해두시고, 실제 전송은 **웹 서버가 컬럼 추가 완료 후 별도 지시서로 진행**.

### 참고
- Health Connect 권한 매니페스트에 `android.permission.health.READ_EXERCISE_ROUTE` 추가 필요 (READ_EXERCISE와 별개).
- 사용자에게 route 권한 요청 UI 추가 필요.

### 우선순위
**Phase 2**. 요청 1 만 먼저 반영해 배포해주시면 됩니다. Phase 2 는 별도 티켓으로 다시 정리해서 보내드리겠습니다.

---

## 검증 방법 (요청 1 배포 후)

1. 앱에서 pause가 포함된 러닝 1건 동기화.
2. Supabase workouts 테이블에서 해당 레코드 조회.
3. `moving_seconds < elapsed_seconds` 인지 확인.
4. pause 없는 세션도 동기화해서 `moving_seconds == elapsed_seconds` 인지 확인.

---

## 요약

| # | 항목 | 필드 | 우선순위 |
|---|---|---|---|
| 1 | pause 뺀 실제 활동 시간 채우기 | `moving_seconds` | **필수** |
| 2 | GPS 경로 저장 | `route` (컬럼 미존재) | Phase 2 (대기) |

문의: 웹앱 담당.
