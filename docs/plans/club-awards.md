# 월별 시상 이력 관리 (club_awards)

클럽이 마일리지 기준으로 매달 시상을 하고 있는데, 그 이력이 어디에도 남지 않는다.
"지난달 1등은 이번달 1등해도 시상 대상이 아니다" 같은 규칙을 나중에 세우려면
먼저 **누가 언제 무슨 상을 받았는지**가 데이터로 있어야 한다.

이번 작업 범위는 **기록·조회까지**다. 제외 규칙(쿨다운) 자체는 넣지 않는다 —
정책이 바뀌어도 쌓인 데이터는 그대로 쓸 수 있으므로 기반부터 깐다.

---

## 1. 스키마

```sql
CREATE TABLE public.club_awards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  year       integer NOT NULL,
  month      integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  award_type text NOT NULL,   -- 'mileage_rank' | 'rookie_rank' | 'mvp' | 클럽 자유값
  rank       integer,          -- 순위형 상일 때 1,2,3… 아니면 NULL
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mileage    numeric,          -- 시상 근거 스냅샷
  note       text,
  awarded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, year, month, award_type, user_id)
);
```

### 설계 근거

- **`award_type` 을 enum 이 아니라 text 로** — 클럽마다 상 이름이 다를 수 있고,
  나중에 상 종류가 늘어날 때 마이그레이션 없이 쓰게 한다. 대신 앱에서 쓰는
  표준값(`mileage_rank` 등)은 서비스 계층 상수로 고정한다.
- **`rank` 는 nullable** — MVP·개근상처럼 순위 개념이 없는 상이 있다.
- **`mileage` 스냅샷** — 마일리지는 재계산(`recalculate_club_mileage`)으로 나중에
  값이 바뀔 수 있다. 시상 당시 근거를 남겨두지 않으면 "왜 이 사람이 1등이었지?"를
  못 설명하게 된다. `club_workout_mileage` 가 이미 `mileage_config_snapshot` 을
  같은 이유로 남기고 있다.
- **UNIQUE 에 `rank` 를 넣지 않음** — Postgres 는 NULL 을 서로 다른 값으로 보므로
  rank 가 NULL 인 상(MVP 등)에 대해 중복 방지가 안 걸린다. "한 사람이 같은 달에
  같은 종류의 상을 두 번 받을 수 없다"가 실제 규칙이므로 rank 를 뺀다.
  동점자 1위 2명은 user_id 가 달라 정상적으로 두 행이 된다.

### 인덱스

```sql
CREATE INDEX club_awards_club_month_idx ON public.club_awards (club_id, year DESC, month DESC);
CREATE INDEX club_awards_user_idx       ON public.club_awards (club_id, user_id, year DESC, month DESC);
```

두 번째는 나중에 "이 사람이 최근 N개월 안에 받았나"(쿨다운 판정)를 위한 것.

### RLS

`hall_of_fame` 선례를 그대로 따른다 (같은 성격의 클럽 표창 데이터).

- SELECT: `TO anon, authenticated USING (true)` — 게스트 모드(anon)에서도 클럽
  화면이 보여야 하고, 랭킹·명전이 이미 공개다.
- 쓰기: `cmer_is_manager(club_id)` — 방장/부방장만.

---

## 2. 서비스 계층 — `src/services/clubAwardService.ts`

```ts
export const AWARD_TYPES = {
  mileage_rank: '마일리지 순위',
  rookie_rank:  '루키 순위',
  mvp:          'MVP',
  attendance:   '개근상',
} as const;

getAwards(clubId, {year, month}?)        // 월별 조회 (연월 생략 시 전체 이력)
getAwardsByUser(clubId, userId, limit?)  // 특정 회원 수상 이력 (쿨다운 판정용 기반)
addAward({...})                          // 수상자 기록
deleteAward(id)                          // 잘못 넣은 기록 삭제
```

`getAwardsByUser` 는 지금 UI 에서 안 쓰지만, 이 작업의 목적("관리 변수화")이
바로 이 조회를 가능하게 하는 것이므로 같이 만든다.

## 3. UI — `/club/settings/:clubId/awards` (운영진 전용)

- 라우트는 `ProtectedClubRoute requireAdmin` 으로 감싼다 (기존 설정 페이지와 동일)
- 클럽 설정 메뉴에 "시상 관리" 항목 추가
- 월 선택 → 그 달 수상자 목록 + 추가/삭제
- 수상자 추가 시 **그 달 랭킹에서 고르게** 한다 — 이름을 직접 타이핑하면 오타·동명이인
  문제가 생기고, 마일리지 스냅샷도 자동으로 채울 수 있다

## 4. 범위 밖 (나중에)

- 쿨다운 규칙(지난달 수상자 제외) 자체의 적용
- 클럽별 쿨다운 개월수 설정
- 랭킹 화면에 "수상 이력" 뱃지 노출
