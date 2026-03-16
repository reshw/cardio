# Cardio Normalization - 적용 가이드

## 📌 개요

유산소 운동의 종목별 난이도 차이를 보정하여 공정한 랭킹을 제공하는 기능입니다.

**핵심 원칙:**
- 기록은 원본 그대로 저장
- 빈 필드(거리, 속도 등)가 있으면 계산해서 채움
- 대시보드 집계 시에만 환산 비율(multiplier) 적용
- UI에서 아이콘으로 환산 비율 명시

## 🎯 환산 비율

| 카테고리 | 종목 예시 | 환산 비율 | 이유 |
|---------|----------|---------|------|
| Running | 러닝, 트레드밀 | 100% (×1.0) | 기준 |
| Stepmill | 천국의계단, 스텝밀, 등산 | 100% (×1.0) | 러닝과 동등한 강도 |
| Rowing | 로잉머신, 조정 | 60% (×0.6) | 상체 중심, 체중 부하 적음 |
| Cycle | 사이클, 실내자전거 | 40% (×0.4) | 앉아서 하는 운동 |
| Other | 엘립티컬, 줄넘기, 수영 | 30% (×0.3) | 기타 유산소 |

## 📋 적용 순서

### 1단계: SQL 함수 생성

```bash
# Supabase SQL Editor에서 실행
```

**파일:** `docs/database/cardio_normalization.sql`

이 파일은 다음 함수들을 생성합니다:
- `get_cardio_category(workout_name)`: 운동명 → 카테고리 매핑
- `get_cardio_multiplier(category)`: 카테고리 → 환산 비율
- `calculate_adjusted_distance(distance_km, adjusted_dist_km, workout_name)`: 최종 환산 거리 계산

### 2단계: 클럽 대시보드 함수 업데이트

```bash
# Supabase SQL Editor에서 실행
```

**파일:** `docs/database/club_dashboard_function.sql`

변경 사항:
- Hall of Fame 배지 "지칠 줄 모르는 심장" → 환산 거리 적용
- Leaderboard Cardio 순위 → 환산 거리 적용

**중요:** 기존 `get_club_dashboard()` 함수를 완전히 교체합니다.

### 3단계: 프론트엔드 코드 확인

다음 파일들이 자동으로 새 환산 비율을 사용합니다:
- ✅ `src/features/parse/normalizeCardio.ts` (유틸리티 함수)
- ✅ `src/pages/Dashboard.tsx` (개인 대시보드)
- ✅ `src/pages/ClubDetail.tsx` (클럽 대시보드 - RPC 호출)

변경 사항 없음 - 이미 적용되어 있습니다.

## 🔍 작동 방식

### 거리 계산 흐름

```
원본 데이터
  ↓
[1] 인클라인 보정 (있는 경우)
  distance_km → adjusted_dist_km
  예: 5km @ 10% incline → 10km
  ↓
[2] 카테고리 감지
  workout.name → cardio category
  예: "사이클" → 'cycle'
  ↓
[3] 환산 비율 적용
  adjusted_dist_km × multiplier
  예: 10km × 0.4 = 4.0km
  ↓
최종 랭킹 반영 거리
```

### 예시

**러닝 (100%)**
- 입력: 5km 러닝
- 계산: 5km × 1.0 = 5.0km
- 랭킹 반영: 5.0km

**사이클 (40%)**
- 입력: 10km 사이클
- 계산: 10km × 0.4 = 4.0km
- 랭킹 반영: 4.0km

**인클라인 러닝 (100%)**
- 입력: 5km 러닝 @ 10% incline
- 인클라인 보정: 5km → 10km (adjusted_dist_km)
- 카테고리 보정: 10km × 1.0 = 10.0km
- 랭킹 반영: 10.0km

**인클라인 사이클 (40%)**
- 입력: 10km 사이클 @ 레벨 5
- 저항 보정: 10km → 12.5km (adjusted_dist_km)
- 카테고리 보정: 12.5km × 0.4 = 5.0km
- 랭킹 반영: 5.0km

## ✅ 테스트 체크리스트

### SQL 함수 테스트

```sql
-- 1. 카테고리 매핑 확인
SELECT get_cardio_category('러닝'); -- 'running'
SELECT get_cardio_category('사이클'); -- 'cycle'
SELECT get_cardio_category('로잉머신'); -- 'rowing'

-- 2. 환산 비율 확인
SELECT get_cardio_multiplier('running'); -- 1.0
SELECT get_cardio_multiplier('cycle'); -- 0.4
SELECT get_cardio_multiplier('rowing'); -- 0.6

-- 3. 환산 거리 계산 확인
SELECT calculate_adjusted_distance(10, NULL, '러닝'); -- 10.0
SELECT calculate_adjusted_distance(10, NULL, '사이클'); -- 4.0
SELECT calculate_adjusted_distance(5, 10, '러닝'); -- 10.0 (adjusted_dist_km 우선)
```

### 클럽 대시보드 테스트

1. ✅ Hall of Fame 배지 "지칠 줄 모르는 심장" 값 확인
   - 여러 종목 섞여있을 때 환산 거리 합계가 맞는지
2. ✅ Leaderboard Cardio 순위 확인
   - 러닝 유저 vs 사이클 유저 순위가 공정한지
3. ✅ 단위 표시 확인: "km 환산" 또는 "km 러닝" → "km 환산"

### 개인 대시보드 테스트

1. ✅ Dashboard.tsx 월간 통계 "총 거리" 확인
   - 여러 종목의 환산 거리가 올바르게 합산되는지
2. ✅ 콘솔 에러 없는지 확인

## 🐛 문제 해결

### SQL 함수가 생성되지 않는 경우

```sql
-- 기존 함수 제거 후 재생성
DROP FUNCTION IF EXISTS get_cardio_category(TEXT);
DROP FUNCTION IF EXISTS get_cardio_multiplier(TEXT);
DROP FUNCTION IF EXISTS calculate_adjusted_distance(NUMERIC, NUMERIC, TEXT);
```

그 다음 `cardio_normalization.sql` 파일을 다시 실행하세요.

### "function ... does not exist" 오류

원인: SQL 함수가 생성되지 않았거나 파라미터 타입이 맞지 않음

해결:
1. `cardio_normalization.sql` 파일 먼저 실행
2. `club_dashboard_function.sql` 파일 실행

### 환산 거리가 0으로 나오는 경우

원인: `distance_km`와 `adjusted_dist_km` 모두 NULL

해결: Workout 데이터에 최소한 `distance_km` 또는 `duration_min`이 있어야 합니다.

## 📝 향후 개선 사항

### Phase 1 (현재) ✅
- 클럽 대시보드 환산 비율 적용
- 개인 대시보드 환산 비율 적용

### Phase 2 (예정)
- UI에 아이콘 표시 (🏃 ×1.0, 🚴 ×0.4 등)
- Workout 상세 페이지에 환산 거리 안내
- "원본 거리 vs 환산 거리" 비교 UI

### Phase 3 (예정)
- 카테고리별 키워드 관리 UI
- 사용자 정의 환산 비율 (클럽별 설정)

## 📚 관련 파일

### Backend (SQL)
- `docs/database/cardio_normalization.sql` - 환산 비율 계산 함수
- `docs/database/club_dashboard_function.sql` - 클럽 대시보드 RPC 함수

### Frontend (TypeScript)
- `src/features/parse/normalizeCardio.ts` - 유틸리티 함수
- `src/pages/Dashboard.tsx` - 개인 대시보드
- `src/pages/ClubDetail.tsx` - 클럽 대시보드
- `src/types/index.ts` - Workout 타입 정의

### Documentation
- `docs/specs/cardio_normalization.md` - 기능 명세서 (사용자 제공)
- `docs/database/APPLY_CARDIO_NORMALIZATION.md` - 이 파일
