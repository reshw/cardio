# iOS Apple Health 연동 앱 작업 지시서

## 개요

기존 Cardio 웹앱(React + Supabase)과 연동되는 iOS 전용 네이티브 앱.
Apple Health의 운동 데이터를 읽어서 Supabase 서버로 전송하고,
클럽 멤버 간 누적 운동량을 비교하는 단순한 앱.

**배포 방식**: TestFlight 외부 테스터 → 안정화 후 App Store 정식 제출

---

## 기술 스택

- **언어**: Swift 5.9+
- **UI**: SwiftUI
- **Health 데이터**: HealthKit
- **백엔드**: 기존 Supabase (PostgreSQL + Auth)
- **Supabase Swift SDK**: `supabase-swift` 패키지
- **최소 iOS 버전**: iOS 16.0

---

## 프로젝트 세팅

### 1. Xcode 프로젝트 생성

```
File → New → Project → App
Product Name: Cardio
Organization Identifier: com.reshw.cardio  (또는 본인 Bundle ID)
Interface: SwiftUI
Language: Swift
```

기존 React 폴더(`D:\dev\cardio`)와 **완전히 별개의 Xcode 프로젝트**로 생성.
MacBook의 적당한 위치에 `cardio-ios/` 폴더로 만들면 됨.

### 2. 패키지 의존성 추가

`File → Add Package Dependencies`에서 아래 추가:

```
https://github.com/supabase/supabase-swift
```

### 3. Info.plist 권한 추가

```xml
<key>NSHealthShareUsageDescription</key>
<string>운동 기록을 Cardio 클럽에 공유하기 위해 건강 데이터를 읽습니다.</string>

<key>NSHealthUpdateUsageDescription</key>
<string>운동 데이터를 동기화합니다.</string>
```

### 4. Xcode Capabilities 활성화

`Target → Signing & Capabilities → + Capability → HealthKit` 추가

---

## 화면 구성 (최소 기능)

```
├── LoginView          # Supabase 이메일 로그인
├── MainTabView
│   ├── SyncView       # Apple Health 동기화 메인 화면
│   └── ClubRankView   # 클럽 누적 운동량 랭킹
```

앱스토어 심사 통과를 위해 SyncView + ClubRankView 최소 2개 화면 필요.
(기능이 너무 빈약하면 Guideline 4.2 Minimum Functionality로 거절됨)

---

## Supabase 연결 정보

iOS 앱에 필요한 키 목록 (값은 웹앱 `.env` 파일에서 복사):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY`는 모바일 앱에 절대 넣지 말 것. 앱 바이너리에서 추출 가능.

iOS 앱에서 `Supabase.swift` 파일 생성:

```swift
import Supabase

let supabase = SupabaseClient(
    supabaseURL: URL(string: "VITE_SUPABASE_URL 값")!,
    supabaseKey: "VITE_SUPABASE_PUBLISHABLE_KEY 값"
)
```

---

## 데이터 모델

기존 `workouts` 테이블에 그대로 INSERT. 웹앱과 동일한 스키마 사용.

```swift
struct WorkoutInsert: Encodable {
    let user_id: String
    let category: String        // "달리기", "사이클", "수영" 등
    let sub_type: String?       // nil 허용
    let value: Double           // 거리(km) 또는 시간(분)
    let unit: String            // "km", "분"
    let intensity: Int          // 기본값 5 (Apple Health에서 강도 못 읽으면)
    let workout_time: String    // ISO8601
    let elapsed_seconds: Int?
    let average_heartrate: Double?
    let device_name: String?
    let source: String          // "apple_health"
    let memo: String?
}
```

### Apple Health → Cardio 카테고리 매핑

```swift
func mapHKWorkoutType(_ type: HKWorkoutActivityType) -> (category: String, unit: String, subType: String?) {
    switch type {
    case .running:        return ("달리기", "km", "러닝")
    case .cycling:        return ("사이클", "km", "아웃도어사이클")
    case .swimming:       return ("수영", "m", nil)
    case .rowing:         return ("로잉", "분", nil)
    case .boxing:         return ("복싱", "분", nil)
    case .yoga:           return ("요가", "분", nil)
    case .stairs:         return ("계단", "층", nil)
    default:              return ("기타", "분", nil)
    }
}
```

---

## 핵심 구현: HealthKit 데이터 읽기 + 서버 전송

### HealthKitManager.swift

```swift
import HealthKit

class HealthKitManager: ObservableObject {
    let store = HKHealthStore()

    // 권한 요청
    func requestAuthorization() async throws {
        let types: Set<HKObjectType> = [
            HKObjectType.workoutType()
        ]
        try await store.requestAuthorization(toShare: [], read: types)
    }

    // 최근 N일 운동 가져오기
    func fetchWorkouts(days: Int = 30) async throws -> [HKWorkout] {
        let startDate = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: Date())
        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKObjectType.workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(query)
        }
    }
}
```

### SyncView.swift (메인 동기화 화면)

주요 로직:
1. HealthKit 권한 요청 버튼
2. "최근 30일 운동 불러오기" → HKWorkout 목록 표시
3. 이미 서버에 있는 항목은 체크 표시 (workout_time + source 기준 중복 체크)
4. "서버에 올리기" 버튼 → Supabase INSERT
5. 성공/실패 토스트 메시지

### 중복 방지

서버 전송 전에 같은 날짜·종류·시간 데이터 있는지 체크:

```swift
// source = 'apple_health' 이고 workout_time이 동일한 레코드 있으면 skip
let existing = try await supabase
    .from("workouts")
    .select("id, workout_time")
    .eq("user_id", value: userId)
    .eq("source", value: "apple_health")
    .execute()
```

---

## ClubRankView (클럽 랭킹)

기존 웹앱의 `club_workout_mileage` 테이블 또는 `workouts` 테이블에서 집계.

```swift
// 클럽 멤버별 이번 달 누적 거리
let data = try await supabase
    .from("club_workout_mileage")
    .select("user_id, total_value, profiles(nickname)")
    .eq("club_id", value: currentClubId)
    .eq("month", value: "2026-06")
    .order("total_value", ascending: false)
    .execute()
```

심플하게 List + 순위 번호로 표시하면 충분.

---

## 빌드 & 배포 절차

### TestFlight (빠른 배포)

1. Xcode → `Product → Archive`
2. `Distribute App → TestFlight & App Store`
3. App Store Connect에서 외부 테스터 이메일 초대
4. 심사 없이 링크/이메일로 설치 가능 (간단한 Beta 심사만 있음, 보통 1일)

### App Store 정식 제출 (나중에)

1. App Store Connect에서 앱 정보 작성
2. 스크린샷 최소 2장 (iPhone 6.5인치, 5.5인치)
3. 개인정보처리방침 URL 필요 (HealthKit 사용 앱은 필수)
4. 심사 1~3일

---

## 주의사항

- HealthKit 앱은 **반드시 실제 기기**에서 테스트 (시뮬레이터에서 HealthKit 데이터 없음)
- Apple Developer 계정 $99/년 (일반 개발자 계정으로 충분, Enterprise 불필요)
- TestFlight 외부 테스터는 최대 10,000명, 90일 단위 갱신
- 클럽 멤버가 직원이 아닌 이상 Enterprise 배포($299/년)는 Apple ToS 위반 → 사용 금지

---

## 작업 우선순위

1. [ ] Xcode 프로젝트 생성 + 패키지 설치
2. [ ] Supabase 이메일 로그인 구현 (LoginView)
3. [ ] HealthKit 권한 요청 구현
4. [ ] Apple Health 운동 목록 읽기 + 화면 표시
5. [ ] Supabase workouts 테이블에 INSERT
6. [ ] 중복 방지 로직
7. [ ] ClubRankView (간단한 랭킹 리스트)
8. [ ] TestFlight 배포


VITE_SUPABASE_URL=https://xfgxanikgdtriytfcrxr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_M7SU3PQpabjYKrOCGN8Niw_fDCjBaNI
