# 클럽별 마일리지 제외 규칙 (커스텀 라벨 + 시간대·기간·카테고리 조건)

> 작성일: 2026-07-01
> 최종 검토: 2026-07-02
> 상태: **기획 확정, 구현 대기**
> 관련: `docs/기안_마일리지_아키텍처_개선.md` (선행 이슈), `docs/수정사항_260409.md` (KST 처리)

---

## 배경

- 클럽마다 마일리지 정책이 다름. 예: 폭염기(7~8월) 낮시간(09~17시) 실외러닝은 안전상 지양 → 해당 조건 운동을 마일리지 미산입 처리하고 싶다.
- 현재는 "카테고리 계수 0" 트릭으로만 미산입 표현이 가능하고, 시간/기간 조건부는 불가.
- 클럽 매니저가 **커스텀 이름·색상의 규칙을 직접 생성**해서 관리할 수 있게 만들자.

---

## 스코프 확정 사항

### 규칙 제외 운동의 운동일수 처리
- **규칙으로 미산입된 운동도 운동일수에는 항상 포함**한다.
  - "활동 자체는 인정, 마일리지만 미산입" 원칙.
  - 규칙별 옵션 없음. 단순화.
- 대신 **운동일수 산입 여부를 카테고리 단위로 세분화**한다 (아래 "운동일수 로직 개선" 참조).

### 규칙 하나가 가지는 속성
- **이름** (예: "폭염제외") — 관리자가 자유 입력
- **라벨 색** (배지 배경/텍스트 색) — 팔레트 선택 or HEX 직접 입력 (Q4)
- **적용 카테고리 / 서브타입** — 규칙당 1개 (Q7)
- **적용 기간** `date_from` ~ `date_to` (MM-DD, KST, 매년 반복, wrap 지원 — Q3)
- **적용 시간대** (KST, 시작시각 기준, hour_to=24로 자정 포함 가능)
- **활성 여부** (on/off)

### 시간 판정 기준
- **workout_time(시작시각) KST 기준만**. 종료시각 미고려.
- 08:59 시작 → 10:00 종료 같은 케이스는 규칙 적용 안 됨 (사용자 수용). 반대로 16:59 시작 → 20:00 종료는 규칙 적용됨.
- 규칙은 매년 반복 (year 필드 없음).

### 스코프 (제외/포함)
- **적용 위치**: 클럽별. 같은 workout이 A클럽에서는 산입, B클럽에서는 제외 가능.
- **미적용**: workout 원본 데이터는 절대 수정하지 않음. `workouts` 테이블 안 건드림.
- 저장 위치는 **`club_workout_mileage`** 스냅샷 테이블.

---

## 기존 로직 활용/충돌 포인트

### 활용
1. **"미적립" 표시 로직**: `WorkoutFeedCard.tsx:362`, `ClubMemberDetailModal.tsx:353` — mileage=0 조건 재활용 가능
2. **관리자 UI**: `ClubMileageSettings.tsx` (부방장+) — 여기에 "제외 규칙" 섹션 추가
3. **DB 트리거 방향**: `docs/기안_마일리지_아키텍처_개선.md` 에서 이미 DB 자동 계산 방향으로 리팩터링 논의 중 → 이 기능도 같은 흐름에 태워야 함

### 잠재 충돌
- **카테고리 계수 0으로 인한 미적립** vs **규칙 적용으로 인한 미적립** — mileage=0만으로는 구별 불가 → **`exclusion_rule_id` 컬럼으로 구별 필수**
- **`count_excluded_workouts_in_days` 전역 옵션** — 현재 `clubs.count_excluded_workouts_in_days` 하나로 계수 0 카테고리를 운동일수에 포함할지 결정. 이번 작업에서 **카테고리별 세분화**로 대체 (전역 옵션 deprecated).

### 활성 카테고리 관리 두 개념 정리
현재 코드에 카테고리 활성/비활성이 **두 소스**에 나뉘어 있음:
- `clubs.enabled_categories jsonb` (legacy) — 배열
- `club_mileage_configs.enabled boolean` (신규, per row)

`getEnabledCategories` 는 `club_mileage_configs` 를 우선 조회 (`clubService.ts:955~`). 이번 작업에서는 **`club_mileage_configs.enabled` 만을 유일한 소스로 취급**. legacy `enabled_categories` 는 이번 스코프에서 건드리지 않되, 규칙 category 드롭다운 옵션도 `club_mileage_configs` 에서 가져온다.

---

## 운동일수 로직 개선 (병행)

### 배경
현재 운동일수 산입 여부는 `clubs.count_excluded_workouts_in_days` **전역 boolean 하나**로 결정 (`clubService.ts:953, 1088, 1148`).
- 문제: 카테고리별 세밀 제어 불가. 예: "요가는 운동일수 제외, 스트레칭은 포함" 대응 못 함.
- `docs/todo_260422.md` 에서 이미 제기됐던 이슈.

### 개선안
`club_mileage_configs` 에 `count_in_workout_days boolean NOT NULL DEFAULT true` 추가.

```sql
ALTER TABLE club_mileage_configs
  ADD COLUMN IF NOT EXISTS count_in_workout_days boolean NOT NULL DEFAULT true;
```

- 카테고리마다 `enabled`(가능운동/피드/마일리지 대상) + `count_in_workout_days`(운동일수 산입) 두 개 독립 flag.
- 기본값 true — 기존 동작 유지.
- 전역 `clubs.count_excluded_workouts_in_days` 는 컬럼 유지, 로직에서만 미사용 (deprecated).

### 마이그레이션 (Q9-b)
- 각 클럽별 기존 `clubs.count_excluded_workouts_in_days` 값을 읽어 그 클럽의 모든 `club_mileage_configs` 로우의 `count_in_workout_days` 초기값으로 반영.
- 이후 관리자가 카테고리별로 개별 조정 가능.

### 마일리지계수 설정 UI 확장
`ClubMileageSettings.tsx` / `MileageConfigModal.tsx` 카테고리 리스트에 체크박스 한 칸 추가:

```
[카테고리]      [계수]  [가능운동]  [운동일수 산입]
달리기-러닝     1.0        ☑           ☑
달리기-트레드밀 1.2        ☑           ☑
요가-일반       0.0        ☑           ☐   ← 마일리지 미산입 + 운동일수 제외
스트레칭        0.0        ☑           ☑   ← 마일리지 미산입인데 운동일수는 포함
```

### 집계 로직 변경
`getClubDetailedStats` (`clubService.ts:943~`):
- 현재: `if (countExcludedWorkouts || mileage > 0) workoutDates.add(...)`
- 변경: `if (config.count_in_workout_days) workoutDates.add(...)`
- 규칙으로 미산입된 운동도 이 flag만 보고 판정 → **Q2 확정(규칙 제외 운동은 운동일수 항상 포함)이 자동 성립** (규칙과 무관하게 카테고리 flag만 봄).

---

## DB 설계

### 1) 규칙 테이블

```sql
CREATE TABLE club_mileage_exclusion_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,

  -- 표시용
  name           text NOT NULL,                   -- "폭염제외"
  label_bg_color text NOT NULL DEFAULT '#ffe0e0', -- 배지 배경색 (hex)
  label_fg_color text NOT NULL DEFAULT '#c00000', -- 배지 텍스트색

  -- 대상
  category       text NOT NULL,
  sub_type       text,                             -- NULL = category 전체

  -- 기간 (매년 반복, KST, 'MM-DD' 형식)
  -- wrap 지원: date_from > date_to 이면 연말~연초 걸침 (예: '12-15' ~ '01-15')
  date_from      text NOT NULL CHECK (date_from ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  date_to        text NOT NULL CHECK (date_to   ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),

  -- 시간대 (KST, 시작시각 기준)
  hour_from      smallint NOT NULL CHECK (hour_from BETWEEN 0 AND 23),
  hour_to        smallint NOT NULL CHECK (hour_to BETWEEN 0 AND 24), -- 24=자정

  enabled        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON club_mileage_exclusion_rules (club_id, enabled);
```

### 2) 스냅샷 확장

```sql
ALTER TABLE club_workout_mileage
  ADD COLUMN IF NOT EXISTS exclusion_rule_id   uuid
    REFERENCES club_mileage_exclusion_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exclusion_snapshot  jsonb;
    -- {"name":"폭염제외","label_bg_color":"#ffe0e0","label_fg_color":"#c00000"}
    -- rule 삭제/수정에도 과거 판정 근거 남기기 위해 표시용 필드는 스냅샷 저장
```

### 3) 운동일수 flag (병행 작업)

```sql
ALTER TABLE club_mileage_configs
  ADD COLUMN IF NOT EXISTS count_in_workout_days boolean NOT NULL DEFAULT true;
```
- 마이그레이션 시 `clubs.count_excluded_workouts_in_days` 값을 읽어 초기값 반영 (Q9-b).

### 4) 조회 인덱스
```sql
CREATE INDEX IF NOT EXISTS idx_club_workout_mileage_exclusion
  ON club_workout_mileage (exclusion_rule_id) WHERE exclusion_rule_id IS NOT NULL;
```
- rule 삭제/비활성화 시 소급 재계산에서 해당 rule 걸린 로우만 빠르게 스캔.

---

## 판정 로직 (KST 기준)

```
match(workout, rule):
  0. rule.enabled = true 인 규칙만 조회
  1. workout.category == rule.category
  2. rule.sub_type IS NULL OR workout.sub_type == rule.sub_type
  3. w_kst = workout_time AT TIME ZONE 'Asia/Seoul'
  4. w_mmdd = to_char(w_kst, 'MM-DD')
     IF rule.date_from <= rule.date_to THEN
       w_mmdd BETWEEN rule.date_from AND rule.date_to
     ELSE  -- wrap 케이스 (예: 12-15 ~ 01-15)
       w_mmdd >= rule.date_from OR w_mmdd <= rule.date_to
  5. hour_from <= EXTRACT(HOUR FROM w_kst) < hour_to
     - hour_to=24는 하루 끝까지 포함
```

**중요**:
- 판정은 **DB 함수(RPC/트리거)에서만** 수행. 클라이언트 브라우저 timezone 신뢰 안 함.
- 규칙이 여러 개 매칭되면 첫 번째로 걸린 규칙 사용 (id 오름차순 or created_at 기준). 어차피 mileage=0 결과는 동일하므로 라벨만 결정적이면 OK.
- `workout_time` 은 `timestamptz` 이므로 UTC/오프셋 무관하게 `AT TIME ZONE 'Asia/Seoul'` 로 정규화되어 판정 (Q6).

---

## 리스크 감사 (2026-07-01)

### 🔴 반드시 먼저 해결 (blocker)

#### R1. RPC/트리거에 exclusion 판정 로직 추가 필수
- **위치**: `src/services/clubService.ts:1959` 부근 `recalculateClubMonthMileage` RPC 호출
- 현재 재계산 로직이 rule을 전혀 모름 → 규칙 만들어도 스냅샷 자동 반영 안 됨
- **해결**: RPC 함수(`recalculate_club_mileage()` 등) 내부에 rule 조회 + 매칭 + mileage=0 처리 + `exclusion_rule_id`/`exclusion_snapshot` 세팅 추가
- **원칙**: 스냅샷 갱신은 오직 이 경로에서만 (클라이언트에서 병렬로 계산해 덮어쓰지 않기)

#### R2. workout_time KST 기준 통일 (Q6 확정)
- `workout_time` = `timestamptz` (timezone-aware 저장). 클라이언트 브라우저 timezone 무관.
- 판정: **DB에서 `AT TIME ZONE 'Asia/Seoul'` 로 KST 정규화 후 hour/date 추출**.
- Strava 웹훅 데이터도 timestamptz 저장이므로 별도 utc_offset 필드 없이 자연 처리됨.

#### R3. `club_workout_mileage` 스키마 확장 마이그레이션 필수
- `exclusion_rule_id` 없으면 프론트에서 "계수 0 미적립" vs "규칙 미적립" 구별 불가
- 배지 커스텀 이름/색상도 표시 불가
- 기존 스냅샷은 `NULL` default라 안전

#### R4. workout 수정/삭제 시 재판정 (Q8 확정)
- workout 시간을 08시 → 14시로 수정하면 규칙 적용 상태가 바뀜.
- **확정**: `workoutService.updateWorkout` / `deleteWorkout` 완료 후 해당 workout의 클럽별 스냅샷 재계산 함수를 명시 호출.
- DB 트리거화는 이번 스코프에서 하지 않음 (기안 아키텍처 리팩터링과 함께 후속).
- 시간 조작 어뷰징(운동은 실제로 했으나 시간을 규칙 밖으로 조정)은 감수.

#### R5. 기존 스냅샷 소급 처리 (Q1 확정)
- 매니저가 규칙 생성 → 그 이전 저장된 스냅샷은 자동 반영 안 됨.
- **확정**: 규칙 저장 시 "소급 재계산 확인 모달" 표시.
  - 옵션: (1) 이번 월만 (2) 지난 3개월 (3) 전체 (4) 안 함
  - 무거운 작업은 백그라운드 처리 안내
- rule 비활성화(enabled=false) / 삭제 시에도 동일 모달로 소급 여부 물음.
  - 안 하면: 해당 rule로 이미 미산입 처리된 스냅샷은 mileage=0 그대로 남음 (revert 안 됨).
- `ClubMileageRetroactive` 페이지 재사용 가능성 검토.

### 🟡 완화 필요

#### R6. 운동일수 로직 카테고리별 세분화로 전환 (Q2·Q9 확정)
- 전역 `clubs.count_excluded_workouts_in_days` → `club_mileage_configs.count_in_workout_days` 로 대체.
- 집계 로직 세 곳 리팩터링: `clubService.ts:953, 1088, 1148`.
- 규칙 제외 운동은 카테고리 flag만 참조 (규칙 여부 무관하게 운동일수는 포함/제외 결정) → Q2 확정 자동 성립.
- `ClubGeneralSettings.tsx:206` 전역 옵션 UI 제거 or "카테고리별 설정으로 이동됨" 안내.

#### R7. 리더보드/모달/통계 데이터 소스 일관성
- 리더보드: RPC `get_club_mileage_summary()` (스냅샷 합산)
- 모달: `mileageMap` (클라이언트 로드)
- 통계: `club_workout_mileage` 직접 쿼리
- **원칙**: 모두 스냅샷만 읽는다. 클라이언트에서 재계산 금지.
- 규칙 적용 후 스냅샷이 최신인지 검증 필요.

#### R8. "미적립" 라벨 렌더링 지점 리팩터링
- 파일: `WorkoutFeedCard.tsx:362`, `ClubMemberDetailModal.tsx:353`
- 현재 "미적립" 하드코딩. 규칙 라벨(이름/색상) 반영해야 함.
- **해결**: 공통 헬퍼 `getWorkoutStatusLabel(mileage, exclusion_snapshot)` 만들어 두 컴포넌트 공유.
  - `exclusion_snapshot` 있으면 → 그 이름/색상 사용
  - 없고 mileage=0이면 → 기본 "미적립" 회색 배지

#### R9. 챌린지/리그 집계 (Q5 확정)
- **확정**: 스냅샷 원칙. 챌린지·팀대항전·루키리그 모두 `club_workout_mileage` 를 그대로 읽는다.
- 진행 중 규칙 추가돼도 과거 스냅샷 자동 변경 안 됨.
- 관리자가 소급 재계산 눌러야 반영.
- 챌린지 결과 발표 이후 규칙 추가·소급 재계산은 결과 뒤집을 수 있으니 UX 경고 문구 필요.

#### R10. Strava 웹훅 timezone (Q6 확정)
- Strava `start_date`(UTC) 저장 시 `timestamptz` 로 들어가면 timezone-aware.
- 판정에서 `AT TIME ZONE 'Asia/Seoul'` 정규화하므로 해외 활동도 자연 처리.
- 다만 "해외에서 09시 KST에 해당하는 로컬 시간에 뛴 활동"이 KST 09시로 판정되지는 않음 (KST 절대시각 기준). 이 정책은 문서화 필요.

### 🟢 확인만

#### R11. Supabase RLS
- 규칙 테이블 RLS: manager + vice-manager만 INSERT/UPDATE/DELETE, 클럽 멤버는 SELECT (부방장+ 접근 통일).
- 스냅샷 테이블 컬럼 추가는 기존 RLS 그대로 유효.

#### R13. rule 비활성화·삭제 정책
- rule `enabled=false` 로 토글 시: 이후 저장/재계산 판정에서 스킵. 기존 스냅샷은 그대로 (mileage=0 유지).
  - 관리자가 소급 재계산 명시 실행 시에만 복원 (rule은 disable 상태이므로 재판정에서 미매칭 → 정상 계수 적용).
- rule DELETE 시: `ON DELETE SET NULL` — 스냅샷의 `exclusion_rule_id` NULL 됨. `exclusion_snapshot` 은 유지 (표시용 근거).
  - 이 상태에서 소급 재계산 시 rule 자체가 없으니 정상 계수 복원.
- **경고**: rule 삭제/비활성화만으로는 자동 복원 안 됨을 UI에서 안내.

#### R12. Android WebView UI 리스크 (Q4 확정 반영)
- `<input type="color">` 는 WebView 호환성 편차 있음 → **팔레트 8~12색 + HEX 텍스트 입력** 조합으로 구성.
  - 팔레트: 버튼 리스트 (배경색 미리보기).
  - 직접 입력: `<input type="text">` + HEX regex 검증 (`^#[0-9a-fA-F]{6}$`).
- 배지 색 대비 검증 (fg/bg 명도차) — 접근성 최소 기준만 검증 or 스킵.
- `CLAUDE.md` 규칙 준수: vh/dvh 금지, 모달은 createPortal, 등.

---

## 관리자 UI (ClubMileageSettings 확장)

### 계수 편집 리스트 (기존 확장)
```
[카테고리]      [계수]  [가능운동]  [운동일수 산입]
달리기-러닝     1.0        ☑           ☑
요가-일반       0.0        ☑           ☐
스트레칭        0.0        ☑           ☑
```
- 오른쪽에 "운동일수 산입" 체크박스 한 칸 추가 (`club_mileage_configs.count_in_workout_days`).

### 마일리지 제외 규칙 섹션 (신규)
```
[ 마일리지 제외 규칙 ]
─────────────────────────
🔴 폭염제외              [편집] [삭제] [활성 토글]
  달리기·러닝 / 07-01 ~ 08-31 / 09~17시

+ 규칙 추가
```

### 규칙 편집 모달
```
 이름:      [ 폭염제외 ]
 대상 종목: [달리기 ▾] [러닝 ▾]        ← club_mileage_configs.enabled 카테고리에서 선택
 기간:      [07-01] ~ [08-31]           ← MM-DD 텍스트, KST, 매년 반복, 연 넘김 OK
 시간:      [09] ~ [17]                  ← KST, workout_time 시작시각 기준, hour_to 최대 24
 라벨 색:
   배경: [🔴][🟠][🟡][🟢][🔵][🟣][⚫][⚪]  or  [#______]  ← 팔레트 또는 HEX
   글자: [🔴][🟠][🟡][🟢][🔵][🟣][⚫][⚪]  or  [#______]
   미리보기: ┌───────┐
             │폭염제외│
             └───────┘
 [활성]
 [저장]  [취소]
```

### 저장 시 소급 재계산 확인 모달 (Q1-b)
```
"이 규칙을 이전 기록에도 적용할까요?"
 ○ 이번 월만
 ○ 지난 3개월
 ○ 전체 기간
 ● 소급 안 함 (신규 저장부터 적용)
 [확인] [취소]

 ※ 챌린지·팀대항전 결과가 이미 발표된 기간에 소급 적용 시
    결과가 바뀔 수 있습니다.
```

---

## 작업 순서 (blocker 우선)

### Phase 1: 운동일수 로직 개선 (선행, 독립 릴리즈 가능)
0-1. `club_mileage_configs.count_in_workout_days` 컬럼 추가 + 기존 전역 값 반영 마이그레이션 (Q9-b)
0-2. 집계 로직 리팩터링 — `clubService.ts:953, 1088, 1148`
0-3. `ClubMileageSettings.tsx` / `MileageConfigModal.tsx` "운동일수 산입" 체크박스 UI
0-4. `ClubGeneralSettings.tsx` 전역 옵션 UI 제거 or 이동 안내

### Phase 2: 제외 규칙 인프라
1. **DB 마이그레이션**
   - `club_mileage_exclusion_rules` 테이블
   - `club_workout_mileage` 컬럼 2개 (`exclusion_rule_id`, `exclusion_snapshot`)
   - `idx_club_workout_mileage_exclusion` 부분 인덱스
   - RLS (부방장+ 쓰기, 멤버 읽기)
2. **DB 함수** (blocker R1, R2)
   - 재계산 RPC 에 규칙 매칭 로직 추가 (KST 정규화, wrap 지원, enabled=true 필터)
   - 신규 workout 저장 흐름(`saveWorkoutMileage`)에서도 동일 판정 재사용
3. **서비스 계층** (`clubService.ts`)
   - Rule CRUD
   - `recalculateAfterRuleChange(clubId, scope)` — scope: `current_month | last_3_months | all | none`
   - `recalculateWorkoutMileage(workoutId)` — workout 수정 후 훅용

### Phase 3: UI
4. **관리자 UI** (`ClubMileageSettings.tsx`)
   - 제외 규칙 리스트/추가/편집/삭제
   - 팔레트 + HEX 입력 색상 UI (Q4-c)
   - 저장 시 소급 재계산 확인 모달 (Q1-b)
5. **표시 UI 리팩터링** (R8)
   - 공통 헬퍼 `getWorkoutStatusLabel(mileage, exclusion_snapshot)`
   - `WorkoutFeedCard`, `ClubMemberDetailModal` 배지 렌더 갱신
6. **workout 수정/삭제 후 재판정 훅** (R4, Q8-b)
   - `workoutService.updateWorkout` / `deleteWorkout` 종료 후 `recalculateWorkoutMileage` 호출

### Phase 4: 검증
7. e2e — "폭염제외" 생성, 겨울 wrap 규칙, 규칙 비활성 케이스, 소급 재계산 옵션 매트릭스
8. 회귀 — 기존 클럽 운동일수가 Phase 1 마이그레이션 후 동일하게 나오는지

---

## 미결 사항 (사용자 확정 필요)

| # | 항목 | 옵션 |
|---|------|------|
| Q1 | 규칙 저장 시 자동 재계산 범위 | ✅ **(b) 확인 후 소급** — 규칙 저장 시 소급 재계산 확인 모달 |
| Q2 | 규칙 제외 운동의 운동일수 포함 여부 | ✅ **(a) 항상 포함** — 카테고리별 `count_in_workout_days` flag로 세분화 |
| Q3 | 연도 wrap 기간 지원 (12/15~1/15) | ✅ **(b) 지원** — `date_from`/`date_to` 두 컬럼 (MM-DD, KST 매년 반복). 겨울시즌 케이스 대응 |
| Q4 | 라벨 색상 지정 방식 | ✅ **(c) 팔레트 + HEX 둘 다** — 기본은 팔레트, "직접 입력" 옵션도 제공 |
| Q5 | 챌린지/리그 집계 규칙 반영 | ✅ **(a) 스냅샷 그대로** — SQL 스냅샷 원칙 유지. 관리자가 명시적으로 소급 재계산 눌러야 반영 |
| Q6 | Strava 해외 활동 timezone | ✅ **(b) utc_offset 저장·활용** — 현 데이터가 이미 timezone-aware이므로 그걸 그대로 활용 |
| Q7 | 규칙 카테고리 다중 선택 | ✅ **(a) 규칙당 1개 (category, sub_type)** — DB 스키마 그대로 유지 |
| Q8 | workout 수정 시 재판정 방식 | ✅ **(b) 서비스에서 명시 호출 (마일드)** — `workoutService.updateWorkout` 후 재계산 호출. 트리거화까진 안 감. 시간 조작 어뷰징은 감수 |
| Q9 | 전역 `count_excluded_workouts_in_days` 처리 | ✅ **(b)** — 마이그레이션 시점에 기존 값을 참고해 카테고리별 `count_in_workout_days` 초기값 세팅 |

### 확정 사항 요약
- 기간: `date_from` / `date_to` (MM-DD, KST, 매년 반복, wrap 지원 — 겨울시즌 대응)
- 챌린지/리그: 스냅샷 원칙 (관리자 소급 재계산 시에만 반영)
- workout 수정: 서비스에서 재계산 명시 호출 (트리거화 안 함, 시간 조작 어뷰징은 감수)

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/clubService.ts` | Rule CRUD, 재계산 호출, 집계 로직 |
| `src/services/workoutService.ts` | workout 수정/삭제 후 재판정 호출 |
| `src/pages/ClubMileageSettings.tsx` | 규칙 관리 UI + 운동일수 산입 체크박스 |
| `src/components/MileageConfigModal.tsx` | 계수 편집 모달에도 체크박스 추가 |
| `src/pages/ClubGeneralSettings.tsx` | 전역 `count_excluded_workouts_in_days` UI 제거/이동 |
| `src/pages/ClubMileageRetroactive.tsx` | 소급 재계산 UI (재사용 검토) |
| `src/components/WorkoutFeedCard.tsx` | 배지 렌더 |
| `src/components/ClubMemberDetailModal.tsx` | 배지 렌더 |
| Supabase RPC/함수 | 실제 판정 로직 (blocker) |
| `supabase/migrations/YYYYMMDD_workout_days_flag.sql` | Phase 1 스키마 |
| `supabase/migrations/YYYYMMDD_club_mileage_exclusion.sql` | Phase 2 스키마 |
| `docs/기안_마일리지_아키텍처_개선.md` | DB 자동 계산 방향 (선행/병행) |
| `docs/수정사항_260409.md` | KST 처리 참고 |
