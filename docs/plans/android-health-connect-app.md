# Android Health Connect 연동 앱 작업 지시서

## 개요

기존 Cardio 웹앱(React + Supabase)과 연동되는 Android 전용 네이티브 앱.
Google Health Connect의 운동 데이터를 읽어서 Supabase 서버로 전송하고,
클럽 멤버 간 누적 운동량을 비교하는 단순한 앱.

**iOS 버전과 구조 동일**, 플랫폼만 다름.

**배포 방식**: APK 파일 직접 배포 (Play Store 불필요, 심사 없음)
→ 파일 공유 링크 또는 카카오톡으로 APK 전송, 사용자가 직접 설치

---

## iOS vs Android 비교

| 항목 | iOS | Android |
|------|-----|---------|
| 개발 도구 | Xcode (맥 전용) | Android Studio (Windows 가능) |
| 언어 | Swift | Kotlin |
| UI 프레임워크 | SwiftUI | Jetpack Compose |
| 건강 데이터 API | HealthKit | Health Connect |
| 배포 방식 | TestFlight / App Store | APK 직배포 가능 |
| 개발자 계정 비용 | $99/년 (필수) | APK 배포 시 무료 |
| 심사 | 필요 | APK 직배포 시 불필요 |

---

## 기술 스택

- **언어**: Kotlin
- **UI**: Jetpack Compose
- **Health 데이터**: Health Connect API (`androidx.health.connect`)
- **네트워크**: Retrofit2 + OkHttp (Supabase REST API 직접 호출)
- **최소 Android 버전**: API 26 (Android 8.0)
- **Health Connect 지원**: Android 9.0+ (API 28+)

---

## 사전 준비

### 1. Android Studio 설치

```
https://developer.android.com/studio
```

Windows에서 무료 설치. JDK 포함되어 있어서 별도 설치 불필요.

### 2. Health Connect 앱 조건

- **Android 14 (API 34) 이상**: Health Connect 기본 탑재
- **Android 9~13**: 사용자가 Play Store에서 "Health Connect" 앱 설치 필요
- 삼성 갤럭시: 삼성 헬스 ↔ Health Connect 연동 설정 필요

---

## 프로젝트 세팅

### 1. Android Studio 프로젝트 생성

```
New Project → Empty Activity
Name: Cardio
Package name: com.reshw.cardio
Save location: (적당한 폴더, 기존 React 프로젝트와 별개)
Language: Kotlin
Minimum SDK: API 26 (Android 8.0)
```

### 2. build.gradle (app) 의존성 추가

```kotlin
dependencies {
    // Health Connect
    implementation("androidx.health.connect:connect-client:1.1.0-rc01")

    // Jetpack Compose (프로젝트 생성 시 자동 포함)
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.compose.material3:material3:1.3.0")

    // 네트워크 (Supabase REST 호출용)
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // 코루틴
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // Lifecycle ViewModel
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")
}
```

### 3. AndroidManifest.xml 권한 추가

```xml
<!-- Health Connect 권한 -->
<uses-permission android:name="android.permission.health.READ_EXERCISE"/>
<uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
<uses-permission android:name="android.permission.health.READ_DISTANCE"/>

<!-- Health Connect 연동 선언 (필수) -->
<queries>
    <package android:name="com.google.android.apps.healthdata" />
</queries>

<application ...>
    <activity ...>
        <!-- Health Connect 권한 rationale 화면 연결 -->
        <intent-filter>
            <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
        </intent-filter>
        <meta-data
            android:name="health_permissions"
            android:resource="@array/health_permissions" />
    </activity>
</application>
```

### 4. res/values/arrays.xml 생성

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <array name="health_permissions">
        <item>androidx.health.connect.client.permission.health.READ_EXERCISE</item>
        <item>androidx.health.connect.client.permission.health.READ_HEART_RATE</item>
        <item>androidx.health.connect.client.permission.health.READ_DISTANCE</item>
    </array>
</resources>
```

---

## Supabase 연결 정보

iOS와 동일한 키 사용. `SupabaseConfig.kt` 파일 생성:

```kotlin
object SupabaseConfig {
    const val URL = ""           // VITE_SUPABASE_URL 값
    const val PUBLISHABLE_KEY = "" // VITE_SUPABASE_PUBLISHABLE_KEY 값
}
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY`는 앱에 절대 넣지 말 것.

---

## 데이터 모델

기존 `workouts` 테이블에 그대로 INSERT. iOS와 동일한 스키마.

```kotlin
data class WorkoutInsert(
    val user_id: String,
    val category: String,           // "달리기", "사이클", "수영" 등
    val sub_type: String? = null,
    val value: Double,              // 거리(km) 또는 시간(분)
    val unit: String,               // "km", "분"
    val intensity: Int = 5,         // Health Connect에서 강도 못 읽으면 기본값 5
    val workout_time: String,       // ISO8601
    val elapsed_seconds: Int? = null,
    val average_heartrate: Double? = null,
    val device_name: String? = null,
    val source: String = "google_health",
    val memo: String? = null
)
```

### Health Connect → Cardio 카테고리 매핑

```kotlin
import androidx.health.connect.client.records.ExerciseSessionRecord

fun mapExerciseType(type: Int): Triple<String, String, String?> {
    // Triple: category, unit, subType
    return when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING         -> Triple("달리기", "km", "러닝")
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> Triple("달리기", "km", "트레드밀")
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING          -> Triple("사이클", "km", "아웃도어사이클")
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> Triple("사이클", "km", "인도어사이클")
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL   -> Triple("수영", "m", null)
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> Triple("수영", "m", null)
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE  -> Triple("로잉", "분", null)
        ExerciseSessionRecord.EXERCISE_TYPE_BOXING          -> Triple("복싱", "분", null)
        ExerciseSessionRecord.EXERCISE_TYPE_YOGA            -> Triple("요가", "분", null)
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING  -> Triple("계단", "층", null)
        else                                                -> Triple("기타", "분", null)
    }
}
```

---

## 핵심 구현: Health Connect 읽기 + 서버 전송

### HealthConnectManager.kt

```kotlin
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.temporal.ChronoUnit

class HealthConnectManager(private val context: Context) {

    private val client = HealthConnectClient.getOrCreate(context)

    val permissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
    )

    // Health Connect 설치 여부 확인
    fun isAvailable(): Boolean {
        return HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }

    // 최근 N일 운동 기록 읽기
    suspend fun readWorkouts(days: Long = 30): List<ExerciseSessionRecord> {
        val startTime = Instant.now().minus(days, ChronoUnit.DAYS)
        val request = ReadRecordsRequest(
            recordType = ExerciseSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, Instant.now())
        )
        return client.readRecords(request).records
    }

    // 특정 운동의 거리 읽기
    suspend fun readDistance(startTime: Instant, endTime: Instant): Double {
        val request = ReadRecordsRequest(
            recordType = DistanceRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )
        return client.readRecords(request).records
            .sumOf { it.distance.inKilometers }
    }

    // 특정 운동의 평균 심박수 읽기
    suspend fun readAvgHeartRate(startTime: Instant, endTime: Instant): Double? {
        val request = ReadRecordsRequest(
            recordType = HeartRateRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )
        val samples = client.readRecords(request).records.flatMap { it.samples }
        return if (samples.isEmpty()) null else samples.map { it.beatsPerMinute }.average()
    }
}
```

### Supabase API 서비스 (Retrofit)

```kotlin
interface SupabaseApi {

    @POST("rest/v1/workouts")
    suspend fun insertWorkout(
        @Header("apikey") apiKey: String = SupabaseConfig.PUBLISHABLE_KEY,
        @Header("Authorization") auth: String,  // "Bearer {access_token}"
        @Header("Content-Type") contentType: String = "application/json",
        @Header("Prefer") prefer: String = "return=minimal",
        @Body workout: WorkoutInsert
    ): Response<Unit>

    @GET("rest/v1/workouts")
    suspend fun getExistingHealthWorkouts(
        @Header("apikey") apiKey: String = SupabaseConfig.PUBLISHABLE_KEY,
        @Header("Authorization") auth: String,
        @Query("user_id") userId: String,
        @Query("source") source: String = "eq.google_health",
        @Query("select") select: String = "workout_time"
    ): List<Map<String, String>>
}

// Retrofit 인스턴스
val retrofit = Retrofit.Builder()
    .baseUrl(SupabaseConfig.URL + "/")
    .addConverterFactory(GsonConverterFactory.create())
    .build()

val api = retrofit.create(SupabaseApi::class.java)
```

---

## 화면 구성 (Jetpack Compose)

```
├── LoginScreen          # 이메일/패스워드 로그인 (Supabase Auth)
├── MainScreen (tabs)
│   ├── SyncScreen       # Health Connect 동기화 메인 화면
│   └── ClubRankScreen   # 클럽 누적 운동량 랭킹
```

### SyncScreen 주요 로직

1. Health Connect 설치 여부 체크 → 미설치 시 Play Store 링크 안내
2. 권한 요청 버튼 (권한 없으면 비활성)
3. "최근 30일 운동 불러오기" → ExerciseSessionRecord 목록 표시
4. 이미 서버에 있는 항목 체크 표시 (중복 방지)
5. "서버에 올리기" 버튼 → Supabase REST POST
6. 성공/실패 Snackbar

### 중복 방지 로직

```kotlin
// 서버에서 기존 google_health 데이터 workout_time 목록 가져오기
val existing = api.getExistingHealthWorkouts(auth = "Bearer $accessToken", userId = userId)
val existingTimes = existing.map { it["workout_time"] }.toSet()

// 업로드 전 필터링
val toUpload = workouts.filter { workout ->
    val isoTime = workout.startTime.toString()
    isoTime !in existingTimes
}
```

---

## APK 빌드 & 배포

### 디버그 APK 빌드 (테스트용, 서명 불필요)

```
Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

결과물 위치:
```
app/build/outputs/apk/debug/app-debug.apk
```

카카오톡 파일 전송 또는 구글 드라이브 링크로 공유.

설치 방법 (수신자):
1. 설정 → 보안 → "출처를 알 수 없는 앱 설치" 허용
2. APK 파일 실행 → 설치

### 릴리즈 APK 빌드 (배포용, 서명 필요)

```
Build → Generate Signed Bundle / APK → APK
→ Create new keystore (최초 1회)
→ 키스토어 파일(.jks)과 비밀번호 안전하게 보관
```

릴리즈 APK는 디버그 APK보다 용량 작고 최적화됨.

> ⚠️ 키스토어 파일 분실 시 동일 패키지명으로 재배포 불가. 반드시 백업.

---

## 삼성 헬스 연동 주의사항

삼성 헬스 데이터를 Health Connect로 읽으려면:
1. 삼성 헬스 앱 → 설정 → Health Connect 연동 → 운동 데이터 허용
2. 이후 Health Connect에서 Samsung Health 데이터 접근 가능

갤럭시 워치 운동 데이터도 삼성 헬스를 통해 Health Connect로 전달됨.

---

## 작업 우선순위

1. [ ] Android Studio 설치 + 프로젝트 생성
2. [ ] Health Connect 권한 설정 (Manifest + arrays.xml)
3. [ ] Supabase 이메일 로그인 구현 (LoginScreen)
4. [ ] HealthConnectManager - 운동 목록 읽기
5. [ ] Supabase REST API 연동 (WorkoutInsert POST)
6. [ ] 중복 방지 로직
7. [ ] ClubRankScreen (간단한 랭킹 리스트)
8. [ ] APK 빌드 + 테스트 배포
