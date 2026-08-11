# 베타 workout_type 도입 계획

> 작성: 2026-06-17 / 상태: 설계 확정 단계 (코딩 미착수)
>
> 출발점: `docs/plans/hikeandvertical.md` (등산/스노보드 마일리지 MET 등가 공식 설계)
>
> 목표: 새로운 마일리지 공식(복합등산, 칼로리헬스, 스노보드)을 **선별된 유저에게만** 노출하면서, 자동 연동(Strava/Apple Health/Google Health) 데이터는 항상 정밀 공식으로 흘려보내기

---

## 1. 컨셉

### 1.1 단순화의 흐름
- ❌ 처음 아이디어: 등산에 `복합` sub_type 추가 + 베타 게이트
  - sub_type이 jsonb·트리거·RPC·`club_mileage_configs`에 "이름 문자열"로 깔려 있어 손댈 면적이 큼
- ✅ 채택: **새로운 workout_type 한 줄 추가** + 베타 게이트
  - sub_type/트리거/RPC 무변경, `workout_types` row 추가 + 컬럼 1개 추가만으로 끝

### 1.2 게이트 방식
- 베타 유저 → 수동 입력 폼에서 새 type 선택 가능
- 비베타 유저 → 수동 입력 폼에서 새 type 안 보임
- **자동 연동 데이터(Strava/Apple Health/Google Health)는 베타 여부 무관, 항상 새 type으로 저장**
- 자동 연동 데이터로 저장된 새 type row는 모든 유저(본인·클럽원)에게 평범하게 보임 (마일리지 숫자만)

### 1.3 비대칭 의도
비베타 유저가 수동으로 복합등산은 못 선택해도, 본인 Strava Hike는 복합등산으로 자동 저장됨.
→ "자동연동은 정확한 데이터니까 강제로 정밀 공식 적용" 일관성 유지.
※ 이 비대칭을 받아들일지 최종 사인 필요.

---

## 2. 신규 workout_type 3개

| name | beta_key | unit | 입력 | 마일리지 공식 | 계수 저장 방식 |
|---|---|---|---|---|---|
| 복합등산 | `hike_composite` | 마일 | distance(km), elevation_gain(m) | `distance × 0.6 + (elev/100) × 0.5` | value = 사전계산 마일리지, coefficient=1 |
| 칼로리헬스 | `gym_calories` | kcal | calories | `calories / 70` | value = calories, coefficient=70 |
| 스노보드(다운힐) | `snowboard` | km | distance(km) | `distance × 0.3` | value = distance, coefficient=3.33 |

### 2.1 백컨트리 스노보드
- 등산 공식과 동일 → **복합등산으로 흡수**. 별도 type 안 만들고 Strava `BackcountrySki`/`Splitboard`도 복합등산으로 매핑

### 2.2 공식의 근거
출처: `docs/plans/hikeandvertical.md` 의 MET 등가 분석 후반부 결론
- 러닝 10km = 10 마일리지 = MET 9.8 × 1h를 기준점으로
- 복합등산: 10km/600m → 7.8 마일 (러닝 7.8km 동급)
- 칼로리헬스: 60kg 러닝 10km ≈ 700kcal → 700/70 = 10 마일
- 스노보드: 활주 MET ≈ 6.3, 러닝 9.8 대비 약 30% → 거리 × 0.3 (슬로프 가중치 생략, 단순화)

### 2.3 복합등산 입력값 보관
- value = 사전계산된 마일리지
- elevation_gain → `workouts.elevation_gain` 컬럼 (이미 존재, Health Connect 마이그레이션이 만들어둠)
- distance → **결정 필요**:
  - (a) 새 컬럼 `workouts.distance_km numeric` 추가
  - (b) elevation_gain과 마일리지로부터 역산 (`distance = (mileage - (elev/100)×0.5) / 0.6`) — 가능하지만 hack
  - (c) jsonb `raw_inputs` 컬럼 — 너무 일반화
  - 추천: (a)

---

## 3. DB 변경

### 3.1 신규 컬럼
```sql
-- 유저별 베타 플래그
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN users.feature_flags IS '베타 기능 플래그. 예: {"hike_composite": true, "gym_calories": true, "snowboard": true}';

-- workout_type 베타 마킹
ALTER TABLE workout_types
  ADD COLUMN IF NOT EXISTS beta_key text;
COMMENT ON COLUMN workout_types.beta_key IS 'NULL이면 일반. 값이 있으면 users.feature_flags[beta_key]=true 유저만 수동 입력 가능.';

-- (결정 시) 복합등산 raw distance
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS distance_km numeric(8,2);
```

### 3.2 신규 workout_type seed
```sql
INSERT INTO workout_types (name, emoji, unit, sub_types, display_order, is_active, sub_type_mode, is_core, beta_key)
VALUES
  ('복합등산', '⛰️', '마일', '[]'::jsonb, 20, true, 'single', false, 'hike_composite'),
  ('칼로리헬스', '🏋', 'kcal', '[]'::jsonb, 21, true, 'single', false, 'gym_calories'),
  ('스노보드', '🏂', 'km', '[]'::jsonb, 22, true, 'single', false, 'snowboard');
```

### 3.3 클럽 마일리지 설정 처리 (미결정)
새 카테고리는 `club_mileage_configs`에 행 없음 → mileage = 0이 됨.

선택지:
- (a) **마이그레이션으로 모든 기존 클럽에 기본 활성화** — coefficient (복합등산=1, 칼로리헬스=70, 스노보드=3.33), enabled=true
- (b) **클럽 어드민이 수동으로 활성화** — 새 타입 발생해도 자동 0
- (c) **폴백 전역 default coefficient 도입** — 클럽 설정 없으면 전역값 사용
- 추천: (a) — 신규 타입이라 클럽 입장에선 "갑자기 0 마일리지로 찍히는" 사고 방지

---

## 4. 코드 진입점 (어디 손대야 하는지)

### 4.1 타입 / 컨텍스트
- `src/contexts/AuthContext.tsx` — User 타입에 `feature_flags?: Record<string, boolean>` 추가
- `src/services/workoutTypeService.ts` — `WorkoutType` 타입에 `beta_key?: string | null` 추가

### 4.2 수동 입력 폼
- `src/pages/AddWorkout.tsx`
- `src/components/AddWorkoutModal.tsx`
  - workout_types 렌더 시 `wt.beta_key && !user.feature_flags?.[wt.beta_key]` 필터
  - 복합등산 선택 시: distance + elevation 입력 UI, 제출 시 공식으로 value 계산
  - 칼로리헬스 선택 시: calorie 입력
  - 스노보드 선택 시: distance 입력 (단순)

### 4.3 어드민
- `src/pages/AdminUserManagement.tsx` — 유저별 베타 토글 UI
- `src/pages/AdminWorkoutTypes.tsx` — workout_type 편집 시 `beta_key` 입력 필드

### 4.4 Strava 매핑 (서버 즉시 반영 가능)
- `api/_strava-shared.ts` `STRAVA_TYPE_MAP`:
  ```
  Hike                → 복합등산  (value_source: 사전계산, requires elevation_gain)
  Snowboard           → 스노보드
  AlpineSki           → 스노보드
  BackcountrySki      → 복합등산
  BackcountrySnowboard→ 복합등산  (Strava에 있는지 확인 필요)
  Splitboard          → 복합등산
  WeightTraining      → 칼로리헬스 (현 헬스에서 변경)
  Crossfit            → 칼로리헬스 (현 헬스에서 변경)
  TrailRun            → ??? (미결정, 4.7 참고)
  ```
- 새 `value_source` 필요: `computed_hike_composite`, `computed_calories`, `distance_km_snowboard`
  - 또는 단순화: webhook 코드에서 category별로 분기
- `api/webhooks/strava.ts` — 분기 로직 추가
- `api/admin/strava-backfill.ts` — 동일 분기

### 4.5 모바일 앱 매핑 (앱 빌드 + 스토어 심사 필요)
- iOS: `docs/plans/ios-apple-health-app.md` 의 `mapHKWorkoutType`
  - `HKWorkoutActivityType.hiking` → 복합등산 (현재 default `기타`로 빠짐)
  - `HKWorkoutActivityType.snowboarding` → 스노보드 (현재 default)
  - `HKWorkoutActivityType.functionalStrengthTraining` 등 → 칼로리헬스
- Android Health Connect: `docs/plans/android-health-connect-app.md` 의 매핑부 동일하게 갱신
- ⚠️ 서버 작업과 별도 task로 분리. 앱 업데이트 전까지는 기존 매핑 들어옴 (호환성 유지)

### 4.6 마일리지 트리거/RPC
- **무변경**. 새 type도 단순 value/coefficient 모델에 들어감

### 4.7 TrailRun 처리 (미결정)
- 옵션 1: 그대로 달리기·러닝 유지 (현재)
- 옵션 2: 복합등산으로 (트레일러닝 = 고도 있는 러닝)
- 옵션 3: 별도 type `트레일러닝` 추가 (오버킬)
- 추천: 옵션 1. 추후 시간 기반 정밀 공식이 본격화될 때 재논의.

---

## 5. 자동연동 흐름 요약

```
[Strava Webhook (서버)]
  Hike → workouts(category='복합등산', value=계산된마일리지, elevation_gain=원본, distance_km=원본)
  Snowboard → workouts(category='스노보드', value=distance)
  WeightTraining → workouts(category='칼로리헬스', value=calories)

[iOS Apple Health 앱 (스토어 심사 필요)]
  HKWorkoutActivityType.hiking → 동일하게 복합등산
  HKWorkoutActivityType.snowboarding → 스노보드
  HKWorkoutActivityType.functionalStrengthTraining → 칼로리헬스

[Android Health Connect 앱 (스토어 심사 필요)]
  ExerciseType.HIKING → 복합등산
  ExerciseType.SNOWBOARDING → 스노보드
  ExerciseType.STRENGTH_TRAINING → 칼로리헬스

[수동 입력 (베타 유저만)]
  복합등산/칼로리헬스/스노보드 셀렉트 옵션 노출
  비베타 유저는 옵션 자체 안 보임 (기존 등산/헬스만)
```

---

## 6. 마일리지 표시·해석

- 복합등산 row: value = 마일리지 그 자체. WorkoutDetail에서 raw distance/elev 별도 표시 (UI 추가 필요)
- 칼로리헬스 row: value = calories, 표시는 `400kcal`. 마일리지는 trigger가 /70 해서 계산
- 스노보드 row: value = distance(km), 표시는 `5.2km`. 마일리지는 trigger가 /3.33 해서 계산
- 피드/랭킹: 기존과 동일하게 마일리지 숫자만 (sub_type 라벨 무관)

---

## 7. 미결정 사항 (내일 사인)

1. **자동연동 → 무조건 새 type 매핑** 흐름 OK?
2. **비대칭 동작 OK?** (비베타 유저 수동 입력 X, but Strava 자동 동기화는 들어옴)
3. **클럽 마일리지 처리** — (a) 기본 활성화 ⟵추천 / (b) 어드민 수동 / (c) 폴백
4. **TrailRun** — 달리기·러닝 유지 ⟵추천 / 복합등산 / 별도 type
5. **복합등산 raw distance 보관** — (a) `workouts.distance_km` 컬럼 ⟵추천 / (b) 역산 / (c) jsonb
6. **착수 순서** — 1) 인프라 → 2) 칼로리헬스(가장 가벼움) → 3) 복합등산 → 4) 스노보드 → 5) 모바일 앱 매핑 (별도 일정)

---

## 8. Task 리스트 (현재)

```
#1 users.feature_flags + workout_types.beta_key 컬럼 추가
#3 수동 입력 필터링 + AdminUserManagement 토글 UI
#4 복합등산 workout_type + 입력 폼 + 공식
#5 칼로리헬스 workout_type + 입력 폼 + 공식
#6 스노보드 workout_type(들) + 공식
```
※ Task #2 (sub_type beta_feature 키)는 폐기됨 (새 type 방식으로 단순화)

추가 필요 task:
- 마이그레이션: 모든 기존 클럽에 신규 type 기본 활성화 (위 결정사항 (a) 채택 시)
- Strava 매핑/Webhook 분기 갱신
- iOS/Android 앱 매핑 갱신 (별도 일정)
- WorkoutDetail/Feed UI에 복합등산 raw distance/elev 표시

---

## 9. 작업 시작 전 체크리스트 (내일 첫 작업)

- [ ] 위 7번 미결정 사항 6개 사인
- [ ] 1단계(인프라) 마이그레이션 작성 → staging 적용
- [ ] AuthContext / workoutTypeService 타입 보강
- [ ] AdminUserManagement 토글 UI

코드 시작은 인프라부터. 각 카테고리는 인프라 끝난 뒤 작은 단위로 한 번에 하나씩.
