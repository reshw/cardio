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
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tags       jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
  awarded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, year, month, user_id)
);
```

### 설계 근거

- **상 종류를 컬럼으로 고정하지 않는다.** 시상 체계는 클럽(테넌트)마다 다르다.
  `award_type` enum 을 두면 클럽이 상을 하나 추가할 때마다 마이그레이션이 필요해진다.
  처음엔 `award_type` + `rank` + `mileage` 를 두려 했으나, 그건 특정 클럽의 운영
  방식을 전체에 강요하는 과설계였다.
- **자유 텍스트 비고가 아니라 `tags` 키워드 배열.** 비고로 두면 나중에 정렬·필터를
  하려 할 때 결국 문자열 파싱을 해야 해서 못 쓰게 된다. jsonb 배열 + GIN 인덱스면
  `WHERE tags @> '["1등"]'` 로 바로 걸린다.
- **UNIQUE 는 (club, year, month, user)** — 한 사람이 같은 달에 두 행을 갖지 않게
  한다. 상을 여러 개 받으면 `tags` 에 함께 넣는다(`["마일리지","1등","개근"]`).
  실제 규칙이 "이 사람이 이번 달 수상자인가"이므로 이 형태가 맞다.

### 인덱스

```sql
CREATE INDEX club_awards_club_month_idx ON public.club_awards (club_id, year DESC, month DESC);
CREATE INDEX club_awards_user_idx       ON public.club_awards (club_id, user_id, year DESC, month DESC);
CREATE INDEX club_awards_tags_idx       ON public.club_awards USING gin (tags jsonb_path_ops);
```

두 번째는 나중에 "이 사람이 최근 N개월 안에 받았나"(쿨다운 판정)를 위한 것.

### ⚠️ 알려진 한계

키워드 배열은 **필터**(1등인 사람 찾기)엔 좋지만 **순위 정렬**(1·2·3등 순으로 나열)은
별도 처리가 필요하다. 순위 정렬이 실제로 필요해지면 그때 nullable `rank` 컬럼을
추가하면 된다 — 기존 행에 영향 없는 무중단 변경이다.

### RLS

`hall_of_fame` 선례를 따른다 (같은 성격의 클럽 표창 데이터).

- SELECT: `TO anon, authenticated USING (true)` — 게스트 모드(anon)도 클럽 화면을 본다
- 쓰기: `cmer_is_manager(club_id)` — 방장/부방장만

실측 검증 완료 (트랜잭션 롤백 테스트 7종): 운영진 기록 허용 / 일반회원·게스트 기록
차단 / 일반회원·게스트 조회 허용 / 키워드 필터 / upsert 중복 방지.

## 2. 서비스 계층 — `src/services/clubAwardService.ts`

```ts
getAwards(clubId, {year, month}?)        // 월별 조회 (연월 생략 시 전체 이력)
getAwardsByUser(clubId, userId, limit?)  // 특정 회원 수상 이력
getUsedTags(clubId)                      // 이 클럽이 쓴 키워드 (입력 추천용)
upsertAward({...})                       // 기록 (같은 달 같은 사람이면 tags 덮어쓰기)
deleteAward(id)
```

`getAwardsByUser` 는 지금 UI 에서 안 쓴다. 하지만 이 작업의 목적("관리 변수화")이
바로 이 조회를 가능하게 하는 것이므로 같이 만들어둔다.

## 3. UI — `/club/settings/:clubId/awards` (운영진 전용)

- 클럽 설정 > **시상 관리** (운영진 전용 섹션, `ProtectedClubRoute requireAdmin`)
- 월 이동 → 그 달 수상자 목록 + 추가/삭제
- **수상자는 그 달 랭킹에서 고른다** (`1위 · 메메 (56.0점)` 형태). 이름을 직접
  타이핑하면 오타·동명이인으로 엉뚱한 사람이 기록된다
- 키워드는 자유 입력 + 이 클럽이 이전에 쓴 키워드를 칩으로 추천 → 표기 흔들림을 줄인다
- 이미 기록된 사람은 후보에서 제외해 중복 선택을 막는다

## 4. 범위 밖 (나중에)

- 쿨다운 규칙(지난달 수상자 제외) 자체의 적용
- 클럽별 쿨다운 개월수 설정
- 랭킹 화면에 "수상 이력" 뱃지 노출
