# [cardio-app] Apple Health 필드 추가 요청 (카드 자동 생성용)

작성일: 2026-07-03
발신: 웹앱 (cardio) 담당
수신: cardio-app (iOS 네이티브) 담당

---

## 배경

웹앱에서 Strava처럼 **Apple Health 기반 workout에도 카드 이미지를 자동 생성**하려 합니다. 서버 사이드(Vercel API + Supabase Database Webhook)로 처리하지만, 카드에 표시할 값 중 일부는 네이티브 앱이 HealthKit에서 읽어 채워서 올려줘야 합니다.

Strava 카드는 페이스/속도, **평균 심박**, **이동 시간(pause 제외)**, 거리를 표시합니다. 같은 수준으로 맞추려면 아래 필드가 필요합니다.

---

## 현재 실측 (원격 Supabase workouts 조회 결과)

```
source = 'apple_health' 기준
  workout_time         ✅ 시작 시간 채워짐
  elapsed_seconds      ✅ 채워짐 (HKWorkout.duration)
  moving_seconds       ❌ null  ← 필요
  average_heartrate    ❌ null  ← 필수 (카드 3대 지표 중 하나)
  max_heartrate        ❌ null  ← 있으면 좋음
  average_speed        ❌ null  ← 서버 계산 가능, 앱은 불필요
  calories             ✅ 채워짐
  steps                ❌ null  ← 있으면 좋음 (걷기 카드용)
  value + unit         ✅ 거리 채워짐
```

**추가로 채워달라는 것: `average_heartrate` (필수), `moving_seconds`, `max_heartrate`, `steps` (선택).**

---

## 요청 1 (필수): `average_heartrate` 채우기

### 왜 필수
- google_health(Samsung Health)는 이미 넣어주고 있어서 카드에 심박 표시됨.
- apple_health는 null → 카드에서 심박 슬롯이 "-" 로 비게 됨. 사용자 경험 편차 큼.

### HealthKit API
HKWorkout 세션 구간의 `HKQuantityTypeIdentifier.heartRate` 샘플을 쿼리해서 평균을 계산합니다.

```swift
import HealthKit

func averageHeartRate(for workout: HKWorkout,
                      healthStore: HKHealthStore) async throws -> Double? {
    let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
    let predicate = HKQuery.predicateForSamples(
        withStart: workout.startDate,
        end: workout.endDate,
        options: .strictStartDate
    )

    // 방법 A: 통계 쿼리 (권장, 빠름)
    return try await withCheckedThrowingContinuation { cont in
        let query = HKStatisticsQuery(
            quantityType: hrType,
            quantitySamplePredicate: predicate,
            options: .discreteAverage
        ) { _, stats, error in
            if let error { cont.resume(throwing: error); return }
            let bpm = stats?.averageQuantity()?.doubleValue(
                for: HKUnit.count().unitDivided(by: .minute())
            )
            cont.resume(returning: bpm)
        }
        healthStore.execute(query)
    }
}
```

권한: `HKQuantityType(.heartRate)` 를 `requestAuthorization(toShare: read:)` 의 `read` 세트에 포함.

### 폴백
- 심박 샘플이 하나도 없으면 (실내 러닝 + 심박 미측정 등) `nil` 로 전송 (`average_heartrate = null`). 서버가 카드에서 "-" 로 폴백.

---

## 요청 2 (필수): `max_heartrate` 채우기

같은 쿼리에서 옵션만 `.discreteMax` 로 바꾸면 됩니다. 이왕 심박 샘플 접근하는 김에 함께 계산.

```swift
options: [.discreteAverage, .discreteMax]
// stats?.averageQuantity() / stats?.maximumQuantity()
```

---

## 요청 3 (필수): `moving_seconds` 채우기

### 의미
- **실제 활동 시간** (pause/resume 제외).
- 카드 페이스 계산이 정확해짐. pause 시간 뺀 시간 기준으로 계산해야 실제 뛴 페이스가 나옴.

### HealthKit API
`HKWorkout.workoutEvents: [HKWorkoutEvent]?` 를 순회해서 pause/resume 페어를 찾고, 그 사이 시간을 총합에서 뺍니다.

```swift
func movingSeconds(for workout: HKWorkout) -> Int {
    let events = workout.workoutEvents ?? []
    var totalPauseSec: TimeInterval = 0
    var pauseStart: Date?

    for e in events.sorted(by: { $0.dateInterval.start < $1.dateInterval.start }) {
        switch e.type {
        case .pause:  pauseStart = e.dateInterval.start
        case .resume:
            if let s = pauseStart {
                totalPauseSec += e.dateInterval.start.timeIntervalSince(s)
                pauseStart = nil
            }
        default: break
        }
    }
    // 마지막 pause 가 resume 없이 종료로 끝난 경우
    if let s = pauseStart {
        totalPauseSec += workout.endDate.timeIntervalSince(s)
    }

    let moving = workout.duration - totalPauseSec
    return Int(moving.rounded())
}
```

### 폴백
- `workoutEvents` 가 nil 이거나 pause/resume 이벤트가 하나도 없으면 → `moving_seconds = elapsed_seconds` 로 동일하게 넣어주세요 (null 대신).

### INSERT 페이로드 변경
현재 `WorkoutInsert` struct 에 `moving_seconds` 필드 추가:
```swift
struct WorkoutInsert: Encodable {
    // ...
    let elapsedSeconds: Int
    let movingSeconds: Int      // ← 신규
    let averageHeartrate: Double?   // ← 신규
    let maxHeartrate: Double?       // ← 신규
    let steps: Int?                 // ← 신규 (요청 4)
    // ...

    enum CodingKeys: String, CodingKey {
        case elapsedSeconds = "elapsed_seconds"
        case movingSeconds = "moving_seconds"
        case averageHeartrate = "average_heartrate"
        case maxHeartrate = "max_heartrate"
        case steps
        // ...
    }
}
```

Supabase workouts 테이블에 관련 컬럼 **이미 존재**. 마이그레이션 불필요.

---

## 요청 4 (선택): `steps` 채우기

걷기/러닝 카드에서 걸음 수를 표시하고 싶습니다. Samsung Health(google_health)는 이미 넣어주고 있음.

```swift
let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount)!
// 위 심박과 동일한 predicate + options: .cumulativeSum
// stats?.sumQuantity()?.doubleValue(for: .count())
```

---

## 요청 5 (선택 · Phase 2): GPS 경로 데이터 (HKWorkoutRoute)

### 배경
장기적으로 지도 경로가 그려진 카드를 만들고 싶습니다. 지금 당장은 아니지만, 나중을 위해 클라이언트 준비를 해두면 좋습니다.

### HealthKit API
```swift
let routeType = HKSeriesType.workoutRoute()

// 1. Workout 에 연결된 HKWorkoutRoute 쿼리
let predicate = HKQuery.predicateForObjects(from: workout)
let routeQuery = HKAnchoredObjectQuery(
    type: routeType,
    predicate: predicate,
    anchor: nil,
    limit: HKObjectQueryNoLimit
) { ... }

// 2. HKWorkoutRoute 에서 CLLocation 배열 얻기
let locationQuery = HKWorkoutRouteQuery(route: route) { _, locations, done, err in
    // locations: [CLLocation]  → 좌표 + timestamp + altitude
}
```

### 저장 방식
- 아직 웹 서버에 `workouts.route` 컬럼이 **없습니다.** 컬럼 스키마는 웹 서버가 나중에 마이그레이션 추가 예정.
- 이번엔 클라이언트에서 CLLocation 추출 코드만 준비. 실제 전송은 **웹 서버가 컬럼 추가 완료 후 별도 지시서로 진행**.

### 참고
- Info.plist 에 `NSHealthShareUsageDescription` 문구에 위치/경로 사용 명시 권장.
- HKWorkoutRoute 접근은 별도 권한 요청 없이 workout read 권한 안에 포함됨.

### 우선순위
**Phase 2.** 요청 1~3 만 먼저 반영해 배포. Phase 2 는 별도 티켓으로 다시.

---

## 검증 방법 (요청 1~3 배포 후)

1. Apple Watch 로 러닝 1건 (pause 포함) 기록.
2. iPhone 에서 앱 실행 → Supabase 동기화.
3. workouts 테이블 조회:
   - `average_heartrate` 값이 채워졌는지 (60~200 범위)
   - `max_heartrate` 값이 채워졌는지
   - `moving_seconds` 가 채워졌는지, `elapsed_seconds` 보다 작거나 같은지
4. pause 없는 세션도 확인 → `moving_seconds == elapsed_seconds`.

---

## 요약

| # | 항목 | 필드 | 우선순위 |
|---|---|---|---|
| 1 | 평균 심박 채우기 | `average_heartrate` | **필수** |
| 2 | 최대 심박 채우기 | `max_heartrate` | 필수 |
| 3 | pause 뺀 활동 시간 채우기 | `moving_seconds` | 필수 |
| 4 | 걸음 수 채우기 | `steps` | 선택 |
| 5 | GPS 경로 저장 | `route` (컬럼 미존재) | Phase 2 (대기) |

문의: 웹앱 담당.
