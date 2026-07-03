# Cardio 로드맵

## 1. 등산 마일리지 고도화

### 현황
현재 등산은 단순 시간/거리 기반. 상행(오르막)과 하행(내리막)이 구분 없이 처리됨.

### 목표: 상행/하행 분리 + MET 기반 등가 마일리지

**대원칙**: 러닝 10km = 10마일 (MET ~9.8) 을 기준으로 모든 액티비티를 에너지 등가로 환산.

---

#### 계수 체계

계단머신을 기준점으로 MET 비율로 모든 계수 도출:

```
계수 = 1.67 × (MET / 10)
```

| 액티비티 | MET | V 계수 | H 계수 |
|---------|-----|--------|--------|
| 계단머신 | 10 | 1.67 | — |
| 등산 상행 | 7 | 1.17 | 0.12 |
| 등산 하행 | 3.5 | 0.585 | 0.06 |
| 스노보드 하강 | 6.3 | 1.05 | 0.11 |

러닝처럼 시간 무관 — "해냈느냐"에 방점.

---

#### 상행 (Ascent)

```
마일리지 = V_m/100 × 1.17 + H_km × 0.12
```

#### 하행 (Descent)

```
마일리지 = V_m/100 × 0.585 + H_km × 0.06
```

---

#### 검증 — 설악산 대청봉 왕복 (V=1400m, H=7.5km 편도)

```
상행: 14×1.17 + 7.5×0.12 = 17.3마일
하행: 14×0.585 + 7.5×0.06 = 8.6마일
합계: 25.9마일
```

> 하프마라톤(21.1km)보다 높음 — 7~8시간 총 에너지 소모 기준으로 타당

---

#### DB 추가 필요 컬럼

```sql
ALTER TABLE workouts ADD COLUMN elevation_gain_m  INT;   -- 획득 고도
ALTER TABLE workouts ADD COLUMN elevation_loss_m  INT;   -- 하강 고도
ALTER TABLE workouts ADD COLUMN ascent_mileage    FLOAT; -- 상행 마일리지
ALTER TABLE workouts ADD COLUMN descent_mileage   FLOAT; -- 하행 마일리지
```

입력 UI에서 상행/하행 고도를 각각 받고, 서버에서 마일리지 분리 계산 후 합산.

---

## 2. 스노보드 체계화

### 데이터 소스 파이프라인

```
장비(애플워치/갤럭시/가민) → Slopes → Strava → Cardio
```

Slopes API 없음. Slopes에서 Strava 자동 업로드 켜두면 Strava 웹훅으로 수신 가능.

---

### Strava activity type 매핑 추가

```typescript
Snowboard:  { category: '스노보드', sub_type: '슬로프',      unit: 'm', value_source: 'elevation_loss' },
AlpineSki:  { category: '스키',     sub_type: '슬로프',      unit: 'm', value_source: 'elevation_loss' },
BackcountrySki: { category: '백컨트리', sub_type: '하이크업', unit: 'm', value_source: 'elevation_gain' },
```

메인 value는 **수직 하강 고도(m)** — 이동거리 대신 버티컬 드롭이 보더의 핵심 스탯.

---

### 스노보드 마일리지 공식

등산과 달리 리프트 대기시간이 포함되어 MET 직접 적용 불가. 실측 기반으로 경험적 계수 결정.

V와 H 동등 가중 (각각 0.2):

```
마일리지 = (V_m / 100 + H_km) × 0.2
```

| 상황 | V | H | 마일리지 |
|------|---|---|----------|
| 가벼운 날 | 2,000m | 15km | 7.0 |
| 중급자 레퍼런스 | 4,000m | 20km | 12.0 |
| 실측 (20런) | 5,529m | 24.2km | **15.9** |

> 실측: 하프(21km)보단 낮고 10km 런보단 위 — 리프트 포함 6~7시간 투자 대비 합리적

등산 하행(MET 3.5 기반 0.585)보다 계수가 낮은 이유: 비활동 시간(리프트)이 전체의 ~45% 차지.

**Strava 필드**: `total_elevation_loss` (V), `distance` (H)

---

### 스노보드 핵심 스탯 표시

| 스탯 | Strava 필드 | 표시 |
|------|------------|------|
| 버티컬 드롭 | `total_elevation_loss` | 1,230m |
| 최고 속도 | `max_speed` × 3.6 | 62 km/h |
| 순수 활주 시간 | `moving_time` | 1h 12m |
| 런 횟수 | 추정치 (Slopes 연동 시 정확) | - |

---

### 백컨트리 하이크업

보드 메고 올라가는 구간 → 등산 상행 공식 그대로 적용.
Strava에서 `BackcountrySki` 또는 `Snowshoe` 타입으로 들어올 수 있음.

---

## 우선순위

1. **등산 상행/하행 분리 입력 UI + 마일리지 계산** — 수동 입력 기반으로 먼저 출시
2. **Strava Snowboard/AlpineSki 타입 매핑** — 웹훅/백필에 타입만 추가
3. **스노보드 스탯 카드 디자인** — 버티컬 드롭 메인으로
4. **백컨트리 하이크업 연동**
