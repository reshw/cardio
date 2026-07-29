# workouts 레거시 중복행 현황 조사 (2026-07-28)

- 근거: cardio-comms msg #31 (from `and`) — "레거시 중복행 DELETE 청소, 삭제 정책 협의 요청"
- 방식: service_role 로 `workouts` / `workout_likes` / `workout_comments` 전량 조회 후 로컬 집계
- **조회만 수행. DELETE·UPDATE 없음.**
- 정한 정책(사용자 결정): **안전하게만 지운다**

## 전체 규모

| 항목 | 값 |
|---|---|
| 총 workouts | 16,260 |
| workout_likes | 2,668 |
| workout_comments | 80 |

source 분포: `manual` 15,871 / `strava` 151 / `apple_health` 131 / `google_health` 107

## 중복 판정 기준

1차로 `user_id + category + workout_time(분)` 으로 잡았더니 107 그룹이 나왔으나, 표본을 열어보니
**같은 분에 기록된 서로 다른 운동**(예: 달리기 2.2km 와 5.3km)이 다수 섞여 있었다 → 과합침.

`value` 까지 일치를 요구하는 기준으로 강화:

> `user_id + category + workout_time(분) + value`

## 결과 (엄격 기준)

| 항목 | 값 |
|---|---|
| 중복 그룹 | 34 |
| 삭제 후보 행 | 34 |
| 안전 삭제 가능 (좋아요·댓글·인증샷 전부 없음) | **27** |
| 검토 필요 (좋아요/댓글/인증샷 있음) | **7** |
| 영향 사용자 수 | 8 |

그룹의 source 조합: `manual` 30, `apple_health+strava` 3, `google_health` 1

## 핵심 발견

### 1. 안드로이드 HC 중복은 프로덕션에 사실상 없다

`and` 가 우려한 `google_health` 레거시 중복은 **전체에서 1건**. v8.60 UPDATE-in-place 이전 물량이
쌓여 있을 거라 봤지만 실제로는 없다. 대규모 DELETE 청소 자체가 필요 없는 상황.

### 2. 중복의 실체는 manual 30건이고, 그중 23쌍은 같은 트랜잭션에서 들어왔다

23쌍이 `created_at` 이 **마이크로초까지 완전히 동일**하다 (예: 두 행 모두 `2026-05-18T11:44:11.667789+00:00`).
개별 HTTP 요청 두 번이면 트랜잭션이 달라 시각이 갈리므로, 같은 트랜잭션 = 일괄 insert 흔적이다.

앱 코드에는 `workouts` 일괄 insert 경로가 없다 — [workoutService.ts:101](../../src/services/workoutService.ts:101) 은
단건 `.insert(insertData).single()` 뿐. 따라서 **외부 스크립트/수동 임포트로 과거 기록을 백필하면서
같은 세션이 두 번 들어간 것**으로 추정된다. (단정 아님 — 유입 경로 확인 필요)

### 3. "먼저 만들어진 행을 유지" 규칙은 그대로 쓰면 안 된다

검토 필요 7건 중 **6건이 삭제 후보 쪽에만 인증샷(`proof_image`)이 있다.** created_at 순으로
앞선 행을 유지하면 인증샷 있는 행이 지워진다.

특히 `apple_health` ↔ `strava` 교차 중복 3건은, 애플헬스 행이 먼저 들어오고 몇 초 뒤 스트라바 행이
인증샷을 갖고 들어온 패턴이다. 이건 레거시 청소가 아니라 **교차 소스 dedup** 이라는 별개 문제.

## 권고 보존 규칙

1. 좋아요·댓글이 하나라도 달린 행은 **삭제 대상에서 제외**
2. `proof_image` 가 있는 행 **우선 보존** (created_at 순서보다 우선)
3. 위 둘로 판정이 안 갈리면 `created_at` 이 이른 행 유지
4. 남는 것만 삭제 → 현재 기준 **27건**

## 미결 사항

- 27건 실제 DELETE 실행 여부 (파괴적 작업 → 사용자 승인 필요, 미실행)
- 검토 필요 7건은 개별 판단 필요 (특히 교차 소스 3건)
- 23쌍 동일 트랜잭션 중복의 유입 경로 확인

## 산출물

- 안전 삭제 대상 id 목록 / 검토 필요 목록: 스크래치패드 `safe-delete-ids.json`
- 조사 스크립트: 스크래치패드 `dup-survey.js`, `dup-survey2.js`, `dup-survey3.js`
