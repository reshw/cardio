# Health Connect / Apple Health 워크아웃 카드 자동 생성 계획

## 배경
- **Strava**: `api/webhooks/strava.ts` webhook 수신 → `workouts` INSERT → `api/_strava-shared.ts:219-280` `generateStravaCard()` 로 SVG→PNG 카드를 R2에 업로드하고 `proof_image`에 URL 저장. 카드에 페이스/속도, 평균 심박, 이동 시간, 거리 표시.
- **Google Health Connect (Android 네이티브 앱)**: 네이티브 앱이 Supabase REST로 `workouts`에 **직접 INSERT** (`source: 'google_health'`). 웹앱 개입 없음 → 현재 카드 생성 안 됨.
- **Apple Health (iOS)**: 계획 단계. 완성되면 동일하게 네이티브가 `workouts` 에 직접 INSERT (`source: 'apple_health'`).
- 마이그레이션 `supabase/migrations/20260611051241_add_health_connect_fields.sql` 로 `calories`, `elevation_gain`, `steps`, `max_heartrate` 컬럼은 이미 존재.

## 목표
Google Health Connect / Apple Health를 통해 들어온 workout 레코드에 대해, Strava와 동일한 수준의 카드 이미지를 자동 생성하여 `proof_image`에 저장한다.

**달리기 카드 표시 항목** (최소):
- 시작/종료 시간 (또는 이동 시간)
- 페이스 (min/km)
- 평균 심박수
- 이동 거리

## 결정 사항

### 트리거 방식: **Supabase Database Webhook → 웹앱 API 엔드포인트**
- **네이티브 앱 코드는 수정하지 않음** (사용자 요구사항).
- Supabase Edge Function (Deno) 대신 웹앱 API 엔드포인트를 쓰는 이유:
  - 기존 `generateStravaCard()`가 `@resvg/resvg-js` (Node native 모듈) 기반 → Deno에서 재사용 불가.
  - 웹앱 API로 라우팅하면 카드 생성 로직을 100% 재사용 가능.
- Supabase Dashboard의 Database Webhook 기능으로 `workouts` INSERT 이벤트를 `https://cardio.scnd.kr/api/webhooks/workout-inserted` 로 POST.

### 흐름
```
Native App (Android/iOS)
    │
    ▼ Supabase REST INSERT (source: 'google_health' | 'apple_health')
workouts table
    │
    ▼ AFTER INSERT (Supabase Database Webhook)
    ▼ POST /api/webhooks/workout-inserted
    │
    ▼ 1. Bearer 토큰 검증
    ▼ 2. source가 health 계열인지 확인 (Strava는 자체 webhook 처리)
    ▼ 3. proof_image 이미 있으면 skip (idempotency)
    ▼ 4. generateWorkoutCard(record) → SVG → PNG
    ▼ 5. R2 업로드 (workout-cards/{id}.png + _thumb.png)
    ▼ 6. workouts.proof_image UPDATE
    │
End
```

## 구현 단계

### 1. 카드 생성 로직 source-agnostic 리팩터링
- `api/_strava-shared.ts` 의 `generateStravaCard(activity)` → `api/_workout-card.ts` 로 분리하여 `generateWorkoutCard(input)` 로 재작성.
- 입력 타입:
  ```ts
  type WorkoutCardInput = {
    id: string;
    source: 'strava' | 'google_health' | 'apple_health';
    category: string;              // 'running' | 'cycling' | 'walking' | 'hiking' ...
    workout_time: string;          // ISO — 시작 시간 통일
    elapsed_seconds: number;
    moving_seconds: number;
    distance_m: number;            // workouts.value (단위 정규화)
    average_speed?: number;        // m/s
    average_heartrate?: number;
    steps?: number;
    elevation_gain?: number;
    calories?: number;
    device_name?: string;
  };
  ```
- Strava webhook 은 기존 activity 페이로드 → `WorkoutCardInput` 매핑 후 호출 (기존 동작 유지, 회귀 없음).

### 2. 카테고리별 카드 데이터 매핑
| 카테고리 | 카드 지표 |
|---|---|
| 달리기 (running) | 페이스 (min/km), 평균 심박, 거리, 이동 시간 |
| 사이클 (cycling) | 평균 속도 (km/h), 평균 심박, 거리, 이동 시간 |
| 걷기 (walking) | 페이스 or 걸음 수, 거리, 시간 |
| 등산/하이킹 (hiking) | 상승 고도, 거리, 시간 |

없는 필드는 카드에서 그 슬롯을 숨기거나 "-" 표시.

### 3. 신규 엔드포인트: `api/webhooks/workout-inserted.ts`
- **인증**: `Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>` 헤더 검증. 실패 시 401.
- **입력 페이로드**: Supabase Database Webhook 표준 `{ type: 'INSERT', table: 'workouts', record: WorkoutRow, schema: 'public' }`.
- **로직**:
  1. `record.source ∈ { 'google_health', 'apple_health' }` 아닌 경우 200 OK 반환하고 종료 (Strava는 자체 webhook에서 이미 카드 생성 중).
  2. `record.proof_image` 이미 값이 있으면 skip (재시도 시 중복 방지).
  3. `WorkoutRow → WorkoutCardInput` 매핑 후 `generateWorkoutCard()` 호출.
  4. R2 업로드: `workout-cards/{id}.png`, `workout-cards/{id}_thumb.png`.
  5. `workouts` UPDATE `proof_image = <url>`.
  6. 실패해도 200 반환 + 로그. Webhook retry 폭주 방지 (workout INSERT는 이미 성공한 상태이므로 카드 실패가 데이터 유실은 아님).

### 4. Supabase Database Webhook 설정
- Supabase Dashboard → Database → Webhooks → Create a new hook
  - Name: `workout_inserted_card_gen`
  - Table: `public.workouts`
  - Events: `INSERT`
  - Type: HTTP Request
  - URL: `https://cardio.scnd.kr/api/webhooks/workout-inserted`
  - Headers: `Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>`
- (대안) SQL 마이그레이션으로 `pg_net.http_post` 트리거를 코드에 커밋해서 재현성 확보 — Dashboard 설정은 환경별 재구성이 번거로움.

### 5. 환경 변수 신규
- `SUPABASE_WEBHOOK_SECRET` — Vercel 환경변수로 추가. Webhook 발신자 검증용 랜덤 시크릿.
- R2 관련 변수는 Strava 경로에서 이미 사용 중인 것 재사용.

### 6. 소스 뱃지 디자인
Strava 카드 상단의 "STRAVA" 뱃지를 source 별로 분기:
- `strava` → 기존 유지
- `google_health` → "Google Health Connect" 텍스트 뱃지 or 로고 (브랜딩 가이드라인 확인 필요)
- `apple_health` → "Apple Health" 텍스트 뱃지 or 하트 아이콘

### 7. 마이그레이션
- 컬럼은 이미 존재하므로 신규 마이그레이션 불필요.

## 사전 확인 결과 (2026-07-03 실측)

원격 Supabase workouts 실데이터 조회 + `cardio-and`(Kotlin), `cardio-app`(Swift) 코드 조사 결과:

### 필드 채움 실태
| 필드 | strava | google_health | apple_health |
|---|---|---|---|
| `workout_time` | 시작 시간 | 시작 시간 | 시작 시간 |
| `elapsed_seconds` | ✅ | ✅ | ✅ |
| `moving_seconds` | ✅ | **null** | **null** |
| `average_speed` | ✅ | **null** | **null** |
| `average_heartrate` | ✅ | ✅ (Samsung Health) | **null** |
| `max_heartrate` | 일부 | ✅ | **null** |
| `calories` | ✅ | ✅ | ✅ |
| `steps` | - | ✅ | **null** |
| `value` + `unit` | 거리 km/m | 거리 km/m | 거리 km/m |

### 확정 사항
1. **`workout_time` 은 세 소스 모두 시작 시간 통일 완료.** 별도 처리 없음.
2. **`moving_seconds` 는 네이티브 앱 수정 없이는 확보 불가.**
   - Health Connect: Samsung Health가 세션 pause 정보를 세션 레코드에 안 넣음. `cardio-and/HealthConnectManager.kt` 는 `elapsed_seconds` 만 전송.
   - Apple Health: `HKWorkout.duration` 은 pause 포함이며, `workoutEvents`(HKWorkoutEventType.pause/resume) 파싱 필요한데 `cardio-app` 미구현.
   - **결론**: 카드/페이스 계산은 `moving_seconds ?? elapsed_seconds` 폴백. pause가 있는 세션은 실제보다 느린 페이스가 표시됨 — 감수.
3. **평균 페이스는 서버 계산.** `(elapsed_seconds / 60) / value_km` (달리기), 속도는 `value_km / (elapsed_seconds / 3600)` (사이클).
4. **평균 심박**:
   - `google_health`: 그대로 사용 가능.
   - `apple_health`: **현재 null**. 서버가 HealthKit에 접근할 수 없으므로 iOS 앱 (`cardio-app`)이 심박 샘플에서 avg를 계산해 INSERT 페이로드에 포함하도록 개선해야 카드에 심박 표시 가능. **이 개선은 이번 스코프 밖. 개선 전까지 apple_health 카드는 심박 슬롯을 "-" 로 폴백.**
5. **GPS path/경로는 이번 스코프에서 제외.**
   - `cardio-and`: Health Connect `ExerciseRoute` 안 읽음.
   - `cardio-app`: `HKWorkoutRoute` 계획 없음.
   - Strava: `activity.map.summary_polyline` 은 API에 있으나 현재 webhook 처리에서 저장 안 함. `workouts` 테이블에 route 컬럼도 없음.
   - path 카드는 별도 프로젝트 필요: (a) `workouts.route` jsonb 컬럼 마이그레이션, (b) 네이티브 앱 route 지원, (c) Strava polyline 저장 로직 추가.
6. **Strava webhook 중복 방지**: 신규 endpoint는 `source ∈ {'google_health', 'apple_health'}` 만 처리, Strava는 자체 webhook 유지.
7. **거리 단위**: `value` + `unit` (km/m/분) 구조 유지. 카드 렌더 시 `unit==='km'` 이면 그대로, `'m'` 이면 /1000, `'분'` 이면 거리 카드 생성 스킵.
8. **소스 로고 사용 권한**: Google Health Connect / Apple Health 로고는 각사 브랜딩 가이드라인 준수 필요 (구현 시 확인).

## 이번 계획에서 제외 (별도 프로젝트로)
- GPS 경로/폴리라인 저장 및 지도 카드
- Apple Health 평균 심박 수집 (`cardio-app` 개선 필요)
- moving_seconds 정확 계산 (양쪽 네이티브 앱 개선 필요)

## 작업 순서 (구현 단계 별도 진행 시)
1. `api/_workout-card.ts` 신설 + `generateWorkoutCard()` 로 source-agnostic 리팩터링, Strava 경로도 이 함수로 위임하도록 변경 (회귀 테스트 필수).
2. `api/webhooks/workout-inserted.ts` 신설.
3. `SUPABASE_WEBHOOK_SECRET` Vercel 환경변수 추가.
4. Supabase Dashboard 에서 Database Webhook 설정.
5. Android 앱에서 실제 workout INSERT 시나리오 E2E 테스트 (테스트 계정으로).
6. iOS 앱 출시 후 동일 경로가 자동 재사용됨을 확인.
