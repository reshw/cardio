# 검토안: iOS dedup의 workout id 변경 문제 (app 메시지 #24)

날짜: 2026-07-08 / 상태: 구현 완료 (dev 커밋) — push + 프로덕션 트리거 SQL 적용 대기

- app 답장 발송 (#25, 스레드 24), and 작업요청 발송 (#26 — google_health 동일 정책 + 삼성헬스 HC 쓰기 버그 현황 문의)
- 마이그레이션: `supabase/migrations/20260708000001_workout_card_update_trigger.sql`
- 웹훅: UPDATE 수용 + 사용자 사진 보존 + `?v=` 캐시버스터

## 1. 문제 정의

iOS 앱의 중복정리(dedup)가 신뢰도 낮은 서버 레코드를 신뢰도 높은 로컬 레코드로 교체할 때
`DELETE(기존 row) → INSERT(새 row)` 방식이라 **workout id가 매번 바뀜**.

## 2. 영향 분석 (id가 바뀌면 유실되는 것들)

| 항목 | 영향 | 비고 |
|---|---|---|
| 좋아요 | **유실** | workout id FK — 기존 id 삭제 시 함께 사라짐 |
| 댓글 | **유실** | 동일 |
| 사용자 업로드 인증사진 | **유실 위험** | 새 INSERT의 proof_image가 null → 자동 카드로 대체됨. 사용자가 직접 올린 사진이 있던 기록이면 사진이 날아감 |
| 알림/공유 딥링크 | **깨짐** | 기존 알림·카카오 공유가 old id를 참조하면 404 |
| 자동생성 카드 | 재생성됨 (문제 없음) | INSERT 트리거가 새 id로 다시 만듦 |
| R2 카드 파일 | old id 파일 고아로 잔존 | 용량 미미, 무시 가능 |

→ 카드만의 문제가 아니라 **소셜 데이터 전반이 유실**되는 구조. 방치 불가.

## 3. 옵션 비교

### 옵션 1 — app이 UPDATE-in-place로 전환 (id 보존) ← **권장**
- 좋아요·댓글·알림링크·사진 전부 자동 보존 (id가 안 바뀌므로)
- 웹/서버 부담: 트리거 확장 + 웹훅 수정 2건, 작업량 반나절 미만 (아래 4절)
- 근본 해결. dedup가 몇 번 일어나든 추가 비용 없음

### 옵션 2 — 서버가 old→new id 마이그레이션
- app이 old id를 서버에 전달해야 함 (INSERT payload에 없음 → 프로토콜 추가 필요)
- dedup와 마이그레이션 사이 타이밍 레이스 (그 사이 좋아요가 달리면?)
- dedup 발생할 때마다 반복 실행되는 영구적 임시방편
- **기각**

## 4. 옵션 1 채택 시 웹/서버 작업 내역

### 4-1. 마이그레이션 SQL (트리거 확장)
- `after insert` → `after insert or update` on workouts
- UPDATE 발화 조건 (모두 충족 시에만):
  - `source in ('google_health', 'apple_health')` — 수기 기록·Strava 편집은 비발화
  - 내용 필드가 실제 변경: value / elapsed_seconds / moving_seconds / average_heartrate /
    max_heartrate / calories / route / category / sub_type / workout_time 중 하나라도
    `IS DISTINCT FROM` old
- **루프 방지**: 카드 생성 웹훅은 proof_image만 UPDATE → 위 내용 필드 가드에 걸리지 않아
  트리거 재발화 없음 (구조적으로 차단)

### 4-2. workout-inserted.ts 수정
- `type === 'UPDATE'` 수용
- 덮어쓰기 정책:
  - proof_image null → 생성 (현행)
  - proof_image가 자동 카드(`/workout-cards/` 포함) → **재생성** (스탯 바뀌었으니 카드도 갱신)
  - 그 외(사용자 업로드 사진) → **보존, 건드리지 않음**
- 캐시버스팅: 같은 id면 R2 파일명이 동일해 브라우저가 옛 카드를 캐싱
  → proof_image URL에 `?v={timestamp}` 부여
  - 확인 완료: 프론트 `getThumbnail()`의 `_thumb` 변환은 쿼리스트링이 붙어도 정상 동작
    (`xxx.png?v=123` → `xxx_thumb.png?v=123`)

### 4-3. 검증 절차
1. 테스트 레코드 INSERT → 카드 생성 확인 (기존 경로 회귀 확인)
2. 내용 필드 UPDATE → 카드 재생성 + `?v=` 갱신 확인
3. 사진 있는 레코드 UPDATE → 사진 보존 확인
4. proof_image만 UPDATE → 트리거 비발화(루프 없음) 확인

### 배포 순서 (중요)
웹/서버(트리거+웹훅) 먼저 배포 → app의 dedup UPDATE 전환은 그 이후.
순서가 뒤집히면 dedup된 기록의 카드가 옛 스탯으로 방치됨.

## 5. app 쪽 요청사항 (답장에 포함)
- UPDATE-in-place 시 content 필드만 갱신, `proof_image`는 건드리지 말 것 (서버 관리)

## 6. 미결
- 구현 착수 시점: 사용자 지시 대기
- app 답장: 초안 작성됨, 발송 승인 대기
