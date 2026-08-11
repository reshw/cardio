# [cardio-and → 웹앱] Phase 2 (GPS 경로) 착수 전 결정사항 요청

작성일: 2026-07-03
발신: cardio-and (Android 네이티브) 담당
수신: 웹앱 (cardio) 담당
연관 문서: `docs/communicate/to.and.md` (2026-07-03, 웹앱 → 앱)

---

## 배경

원문 요청서(`to.and.md`)에서 Phase 1 (`moving_seconds` 채우기)은 그대로 진행합니다. 별도 회신 없이 배포하겠습니다.

Phase 2 (`workouts.route` GPS 경로 저장)는 "웹 서버가 컬럼 추가 완료 후 별도 지시서로 진행"이라고 하셨는데, **컬럼 스키마·포맷 결정에 앱쪽 시리얼라이즈 코드가 종속**됩니다. 지시서 오기 전에 아래 6개 항목만 미리 확정해주시면, 지시서 도착 시 바로 구현 착수 가능합니다.

Health Connect API 자체는 `ExerciseSessionRecord.route` → `ExerciseRoute.route: List<Location>`으로 **좌표·타임스탬프·고도·정확도까지 전부 뽑을 수 있음**을 확인했습니다. 따라서 무엇을 어떤 형태로 보낼지는 순전히 서버·카드 렌더 파이프라인 요구사항에 달려 있습니다.

---

## 결정 요청 항목

### 1. Supabase 컬럼 타입

- [ ] `jsonb` — 심플, 쓰기·읽기 편함. 나중에 파싱해서 렌더
- [ ] PostGIS `geometry(LineStringZ, 4326)` — 공간 인덱스 가능, "근처에서 뛴 사람들의 코스" 같은 쿼리 여지

**Q. 어느 쪽인가요?**

`jsonb`면 앱은 그냥 직렬화해서 body에 실어보내면 되고, PostGIS면 WKT/EWKT 문자열이나 GeoJSON 중 뭘 받으실지 알려주세요.

---

### 2. 저장 포맷

- [ ] **GeoJSON LineString** — `{"type":"LineString","coordinates":[[lon,lat,alt],...]}`
- [ ] **Encoded Polyline** (Google 방식) — lat/lon만, 초압축. Strava·구글 지도 표준
- [ ] **원시 JSON 배열** — `[{"t":"...","lat":..,"lon":..,"alt":..},...]` (timestamp 유지)
- [ ] 기타 (지정)

**Q. 어느 쪽인가요?**

핵심 갈림길은 **timestamp가 필요하냐**입니다:
- 페이스 그래프, 구간별 속도 표시 등을 카드에 넣을 계획이면 timestamp 필요 → 원시 배열 또는 GeoJSON + 별도 `times` 필드
- 단순 경로 라인만 그릴 거면 timestamp 불필요 → GeoJSON LineString 또는 Encoded Polyline

---

### 3. 다운샘플링

Health Connect는 원본 GPS 포인트를 그대로 줍니다. 러닝 1시간 세션이면 3000~5000 포인트 수준입니다.

- [ ] **원본 그대로 전송** (저장 비용 ↑, 재렌더·코스 매칭 유연성 ↑)
- [ ] **앱에서 N포인트로 다운샘플링** (N값 지정 필요)
- [ ] **원본 전송 + 서버에서 다운샘플링**

**Q. 어느 쪽인가요? 다운샘플링한다면 목표 포인트 수는?**

권장: 원본 유지 (`jsonb` gzip 압축 후 세션당 ~50KB 예상). 카드 렌더 시 서버가 필요한 만큼 줄여쓰면 됨.

---

### 4. Health Connect 권한 정책 (백그라운드 sync 여부)

Health Connect의 route 권한은 두 종류입니다:

| 권한 | 특성 | 심사 |
|---|---|---|
| `READ_EXERCISE_ROUTE` (단수) | 사용자가 앱 열 때마다 세션별 개별 동의 팝업 | 심사 X |
| `READ_EXERCISE_ROUTES` (복수) | 백그라운드 sync 가능, 한 번 승인 | **Google Play Console 심사 O** |

카드 자동생성이 **백그라운드 sync 전제**(사용자가 앱 안 열어도 카드 생성)라면 복수형이 필요하고, 심사·정책 문구 추가 작업이 붙습니다.

**Q. 백그라운드 자동 카드 생성 시나리오인가요, 아니면 사용자가 앱 열 때 sync 되면 되는 시나리오인가요?**

- 백그라운드 필요 → 복수형 권한, Play 심사 리스크 감수
- 포그라운드만 → 단수형 권한, 사용자가 매번 세션별 동의 팝업 봐야 함

---

### 5. 카드 렌더 파이프라인 (앱 작업 아님, 포맷 결정과 얽힘)

- Mapbox Static API? OSM 타일? 자체 SVG?
- 지도 배경 유무 (배경 있으면 타일 라이선스·비용 이슈)

**Q. 대략 어떤 방향인가요?**

Mapbox Static 쓸 거면 GeoJSON이 자연스럽고, 자체 SVG 렌더면 Encoded Polyline도 무난합니다.

---

### 6. Phase 1 배포와 Phase 2 배포 텀

- [ ] 동시 배포 (컬럼 추가 완료까지 Phase 1도 대기)
- [ ] Phase 1 먼저, Phase 2 별도 (권장)

**Q. 어느 쪽인가요?**

Phase 1 먼저 나가는 게 카드 자동생성 파이프라인 검증도 빨리 가능해서 권장합니다. Phase 2는 지시서 오면 별도 릴리즈로.

---

## 참고: Health Connect route 데이터 실제 구조

```kotlin
val route: ExerciseRoute? = session.route
route?.route?.forEach { location ->
    location.time                // Instant
    location.latitude            // Double
    location.longitude           // Double
    location.altitude            // Length? (Samsung Health 대부분 채움)
    location.horizontalAccuracy  // Length? (Samsung Health 종종 null)
    location.verticalAccuracy    // Length? (Samsung Health 종종 null)
}
```

Samsung Health가 GPS 기록 켠 세션만 `route`가 non-null. 실내 러닝·헬스장은 항상 null.

---

## 요약

Phase 1은 별도 회신 없이 진행. Phase 2 지시서 보내주실 때 위 **6개 항목 결정값**만 명시해주시면, 지시서 도착과 동시에 구현 착수 가능합니다.

문의: cardio-and 담당.



# [cardio-app → cardio] Apple Health GPS 경로 저장 관련 질의

작성일: 2026-07-03
발신: cardio-app (iOS 네이티브) 담당
수신: 웹앱 (cardio) 담당

관련: `to.app.md` §5 (Phase 2 · GPS 경로 데이터)

---

## 배경

`to.app.md` 요청 1~4 (moving_seconds, average/max_heartrate, steps) 는 이번 빌드에서 반영 예정. 문제는 §5(route)를 "Phase 2 대기"로 미뤄둔 부분인데, Strava 소스 카드에는 이미 경로가 나오고 있는 걸로 알고 있어서 apple_health 만 계속 비어 있는 게 사용자 체감상 편차가 크게 남을 것 같음. 이번 배포에 같이 태우거나, 최소한 스펙을 확정해서 다음 사이클에 바로 붙이고 싶어요.

앱 쪽에서 결정 못 하는 부분이 여럿이라 아래를 확인해주세요.

---

## Q1. Strava 는 지금 route 를 어떻게 받아 저장하고 있나요?

카드 렌더링 통일이 목적이므로 apple_health 도 같은 파이프라인에 태우는 게 이상적입니다.

- **데이터 소스**: Strava API 의 `map.summary_polyline` (encoded polyline) 를 그대로 저장? 아니면 서버에서 디코딩해서 별도 포맷으로 변환?
- **컬럼**: `workouts` 테이블의 어떤 컬럼에, 어떤 타입으로 (text? jsonb? geometry?) 저장되고 있는지.
- **카드 렌더링 시점**: 저장된 값을 카드 생성 API 가 그때그때 SVG 로 그려서 이미지에 합성하는지, 아니면 미리 렌더링된 정적 SVG/PNG 를 Storage 에 캐싱하는지.

---

## Q2. apple_health route 는 어떤 포맷으로 올려드릴까요?

HKWorkoutRoute → `[CLLocation]` 배열을 얻는 것까진 클라이언트 측 확정 사항이지만, **전송 포맷은 서버가 원하는 방향에 맞추고 싶습니다.** 후보:

| 포맷 | 크기 | 서버 처리 |
|---|---|---|
| A) Encoded polyline (Google/Strava 방식, base64 유사) | 소 | Strava 와 동일 파이프라인 재사용 가능 |
| B) GeoJSON `LineString` | 중 | PostGIS 있으면 쿼리 편함 |
| C) GPX XML | 대 | 표준, 외부 앱 export 시 유리 |
| D) Raw JSON 좌표 배열 `[[lat,lng,ts,alt], ...]` | 대 | 서버 사이드에서 자유 변환 |

Strava 와 통일한다면 **A) polyline 이 자연스러워 보이는데**, 서버 결정 부탁드립니다.

부가 정보:
- 고도(altitude) 포함 여부 (Apple Watch 로는 얻어짐)
- 타임스탬프 포함 여부 (페이스 히트맵 만들 여지)

---

## Q3. 다운샘플링 상한

Apple Watch 러닝 세션은 GPS 샘플이 **수천 ~ 수만 포인트** (1~5초 간격). 그대로 올리면 payload 가 커요.

- 서버에서 원하는 상한 (예: "최대 500 포인트, 넘으면 클라이언트에서 Douglas–Peucker 로 단순화") 이 있나요?
- 아니면 원본 그대로 받아서 서버가 카드 렌더링 시점에 단순화할 계획인가요?

---

## Q4. 컬럼 스키마 & 마이그레이션 일정

`to.app.md` 는 "웹 서버가 컬럼 추가 후 별도 지시서" 라고 되어 있는데:

- 컬럼명·타입 초안이 있으면 미리 확정 부탁 (`route`? `route_polyline`? `gps_track`?). 앱 페이로드 필드명 맞추려면 확정이 먼저 필요.
- 마이그레이션 예정 시점이 대략 언제인가요? 이번 배포(요청 1~4 반영)에 route 도 태울 여지가 있으면 이후 별도 배포 한 번을 아낄 수 있습니다.

---

## Q5. 임시 우회안 검토 요청

컬럼 추가 일정이 지연될 것 같으면, **앱에서 SVG path 문자열을 직접 생성해서 텍스트로 저장하는 방식**도 검토 가능합니다.

- 앱: CLLocation → 정규화된 SVG `path d="M ..."` 문자열 생성
- 서버: 그걸 그대로 카드 배경 SVG 에 삽입
- 컬럼: 예를 들어 `route_svg_path text` 하나만 추가하면 스키마 부담이 최소.

이 방식이 카드 렌더링 팀 입장에서 편한가요, 아니면 원본 좌표를 저장해두는 게 향후 확장(경로 편집·리플레이·통계) 여지가 있어 선호되나요?

---

## Q6. legacy 기록 backfill

컬럼이 열리는 시점 기준으로:

- 이후 업로드분만 route 포함시킬지
- 아니면 이전에 이미 올라간 apple_health workouts 도 앱이 재조회해서 backfill 할지

앱 쪽 부담은 backfill 이 훨씬 큽니다 (HealthKit 다시 조회 + 이미 처리한 UUID 재순회). 서버 카드 재생성 코스트도 별개로 있을 텐데, 정책 결정 부탁드려요.

---

## 요약 · 우선순위

| # | 질문 | 답이 필요한 이유 |
|---|---|---|
| 1 | Strava route 현행 저장 방식 | 파이프라인 통일 여부 판단 |
| 2 | apple_health 전송 포맷 (polyline/GeoJSON/…) | 클라이언트 인코딩 로직 결정 |
| 3 | 다운샘플링 상한 | 페이로드 크기 결정 |
| 4 | 컬럼명·타입, 마이그레이션 일정 | 이번 배포 포함 여부 결정 |
| 5 | SVG path 우회안 가능성 | 스키마 지연 대응 |
| 6 | legacy backfill 정책 | 앱 재조회 로직 필요 여부 |

Q1·Q2·Q4 만이라도 먼저 답 주시면 다음 스프린트에 반영 가능합니다.

---

문의: cardio-app 담당.
