# RLS 전면 정비 계획

2026-08-13, `app` 에이전트의 제보(`workouts` 쓰기 정책 무방비)를 계기로 프로덕션 DB
(`cardio's every` / `xfgxanikgdtriytfcrxr`) 전수 조사한 결과와 조치 계획.

**세 프로젝트(web / and / app) 공통 스펙 문서**다. 후속 개발은 여기 정의된 계약을 전제로 한다.

---

## 1. 실측 결과 — 제보는 사실이고 범위가 더 넓다

`pg_policies` 직접 조회 (덤프가 아닌 라이브 DB 기준).

### 1-1. `(true)` 정책이 걸린 테이블 25개

`USING (true)` 또는 `WITH CHECK (true)` 이면서 role 이 `{public}`(= 미인증 `anon` 포함):

```
app_releases, audit_logs, cardio_details, challenges, club_feeds, club_members,
club_mileage_configs, club_workout_mileage, clubs, comment_likes, daily_todos,
demo_users, hall_of_fame, notifications, race_records, reports, system_settings,
todo_workouts, user_blocks, user_profiles, users, workout_comments,
workout_likes, workout_logs, workout_types, workouts
```

RLS 자체는 전 테이블 `enabled` 지만 정책이 전부 통과라 **켜나 마나인 상태**.

### 1-2. 제일 심각한 건 `workouts` 가 아니라 `users`

```sql
CREATE POLICY "Enable all for users"   ON public.users FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "Allow public update"    ON public.users FOR UPDATE USING (true);
```

`users` 에 `is_admin` / `is_sub_admin` / `is_super_admin` 컬럼이 있고,
[userService.ts:139](../../src/services/userService.ts) 가 클라이언트에서 직접 이 컬럼을 UPDATE 한다.
슈퍼어드민 검사는 [AdminUserManagement.tsx:30](../../src/pages/AdminUserManagement.tsx) 의 **UI 조건문뿐**이고
DB 는 아무것도 검증하지 않는다. 따라서 로그인조차 없이 publishable key 만으로:

```
PATCH /rest/v1/users?id=eq.<임의의 사용자>
{"is_super_admin": true}
```

가 통과한다. **권한상승이 무인증으로 가능한 상태.**
추가로 261명의 `email`(259) · `phone_number`(198) · `birthyear`(198) · `gender`(198) 가
`anon` 에게 전부 읽힌다.

### 1-3. ⚠️ `(true)` 를 그냥 지우면 앱이 통째로 멈춘다 (제일 중요)

정책이 **두 세대**로 섞여 있다.

| 세대 | 판정식 | 상태 |
|---|---|---|
| 구세대 | `auth.uid() = user_id`, `users.id = auth.uid()` | **항상 false — 죽은 정책** |
| 신세대 | `app_user_id()`, `cmer_is_member()`, `is_club_event_member()` | 정상 |

배경: 최초엔 카카오 로그인을 직접 구현해 `public.users` 가 원장이었고, 이후 Supabase Auth 로
일원화(kakao/apple 등 멀티 트랙)하면서 `auth_id` 가 뒤늦게 붙었다. 그래서
**`auth.uid()`(= `auth_id`) 와 `public.users.id` 는 다른 값**이다.

실측:

```
users 261명 → auth_id 보유 173, NULL 88(일원화 이후 미재로그인 레거시),
              id = auth_id 인 경우 4명뿐, 다른 경우 169명

자식 테이블은 전부 users.id 를 참조:
  workouts 17115/17117 · club_members 269/271 · notifications 2923/2923
  · challenge_participants 60/60 · workout_logs 70/70 · user_profiles 1/1
```

즉 구세대 정책은 지금 **아무 일도 하지 않고** 있고, 옆에 붙은 `(true)` 정책이 OR 로 통과시켜
앱이 돌아가는 중이다. `(true)` 만 떼면 남는 건 죽은 정책뿐 → **전면 장애**.

> 이번 작업의 본체는 "`(true)` 제거"가 아니라 **"구세대 정책을 `app_user_id()` 기반으로 재작성"** 이다.

### 1-4. 곁다리로 발견된 것

- `challenge_participants` 는 `(true)` 정책이 **없고** 4개 정책이 전부 구세대(`cm.user_id = auth.uid()`)
  → **이미 프로덕션에서 깨져 있을 가능성**이 높다 (4명 제외 전원). 별도 확인 필요.
- `is_club_manager(club_uuid)` 함수가 구세대 판정(`club_members.user_id = auth.uid()`) → 깨져 있음.
  정상 동작하는 건 `cmer_is_manager()` / `is_club_event_manager()`.
- `reports` 의 `admins_read_reports` 정책이 `(... admin 검사 ...) OR true` → **`OR true` 때문에 전체 공개**.
- `socialGatheringService.ts` 가 참조하는 `social_gatherings` / 소셜포인트 테이블은
  프로덕션에 **존재하지 않는다** (미배포 기능으로 보임). 이번 범위 밖.

### 1-5. 다행인 것 — 쓰기 트리거가 전부 SECURITY DEFINER

```
sync_club_workout_mileage · handle_workout_inserted
create_comment_notification · create_like_notification
handle_notification_inserted · link_or_create_user
```

전부 `SECURITY DEFINER` 라 RLS 를 우회한다. 따라서
**`club_workout_mileage` · `notifications` · `users` 의 INSERT 를 클라이언트에서 완전히 차단해도**
마일리지 집계 · 알림 생성 · 신규 가입이 정상 동작한다. (클라이언트 직접 insert 코드도 없음을 확인)

---

## 2. 결정 사항

| 항목 | 결정 |
|---|---|
| 게스트 모드 `?tmp=N` | **읽기 전용으로 격하.** anon 은 조회만, 쓰기 전면 차단 |
| `notifications` | **본인 것만** 조회 (현재 2923건 전체 공개) |
| `workouts` 조회 | **공개 유지.** 클럽 초대코드로 자유 가입이 가능한 구조라 클럽 단위로 좁혀도 실효가 적고, 기록 열람은 앱의 존재가치 자체 |
| `users` 조회 | **PII 차단.** 닉네임·프로필사진까지만 허용하고 email/전화/생년/성별/kakao_id 는 차단 |
| 적용 | 마이그레이션 작성 → 검증 → 승인 후 prod 적용 |

### 2-1. 게스트 모드의 의미

[AuthContext.tsx:155](../../src/contexts/AuthContext.tsx) 의 `?tmp=N` 경로는 `demo_users` 매핑으로
`setUser` 만 하고 **supabase auth 는 건드리지 않는다** → 게스트는 `anon` role 로 특정 user_id 를 행세한다.
이것이 anon 쓰기를 열어둬야 했던 유일한 이유였다. 읽기 전용으로 격하하면 anon 쓰기를 전면 차단할 수 있다.

- 현재 `demo_users` 는 **1건**뿐이라 영향 최소.
- 게스트 상태에서 쓰기 UI 를 숨기는 처리가 현재 2곳뿐
  ([Header.tsx:125](../../src/components/Header.tsx), [More.tsx:424](../../src/pages/More.tsx))
  → 기록 추가/댓글 등도 숨기거나 안내 처리 필요 (후속 UI 작업).

### 2-2. `users` PII 차단 방식 — 컬럼 단위 권한 회수

남의 정보를 읽는 코드가 **예외 없이 `display_name` / `profile_image` 만** 요청한다는 걸 확인했다:

```
clubService 258·1591·1643 · feedService 128·205 · notificationService 38·158
socialGatheringService 70·145·164 · socialPointService 141
```

따라서 **행(row) 단위로 막지 않고 컬럼 단위 `GRANT` 로 회수**한다.
기존 조인·임베드 쿼리를 한 줄도 안 고쳐도 되고, **and/app 의 쿼리도 그대로 산다**.

```sql
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT  SELECT (id, auth_id, username, display_name, nickname, profile_image,
               provider, created_at, updated_at, deleted_at,
               is_admin, is_sub_admin, is_super_admin, is_tester, push_muted)
  ON public.users TO anon, authenticated;
-- 회수: email, phone_number, birthyear, gender, kakao_id, deleted_snapshot
```

> ⚠️ Postgres 컬럼 권한은 `WHERE` 절에서 참조하는 컬럼에도 적용된다.
> `AuthContext` 가 `.eq('auth_id', …)` 로 조회하므로 `auth_id` 는 반드시 GRANT 에 포함해야 한다.

본인 PII / 어드민 PII 는 SECURITY DEFINER RPC 로 우회 제공한다 (§3-3).

---

## 3. 적용 설계

### 3-1. 표준 판정 헬퍼

기존 `public.app_user_id()` (STABLE SECURITY DEFINER, `auth.uid()` → `users.id`) 를 기준으로 통일하고
어드민 판정 헬퍼를 신설한다. 컬럼명 `is_admin` 과 충돌하지 않도록 `app_` 접두사를 쓴다.

```sql
public.app_user_id()          -- 기존
public.app_is_admin()         -- 신설: is_admin OR is_sub_admin OR is_super_admin
public.app_is_super_admin()   -- 신설
```

클럽 권한은 기존 정상 헬퍼를 재사용: `cmer_is_manager(club_id)` · `cmer_is_member(club_id)` ·
`is_club_event_manager(club_id)`(커스텀 등급 권한 포함) · `is_challenge_club_manager(challenge_id)`.
깨진 `is_club_manager(club_uuid)` 는 `app_user_id()` 기반으로 수정한다.

**성능**: 정책 안에서는 `(SELECT public.app_user_id())` 로 감싼다. STABLE 함수를 SELECT 로 감싸면
Postgres 가 InitPlan 으로 한 번만 평가한다 — `workouts` 17k 행에서 행마다 재평가되는 걸 막는다.

### 3-2. 테이블별 정책

읽기(SELECT)를 여는 대상은 `anon, authenticated` (게스트 읽기 전용 유지),
쓰기는 전부 `authenticated` 전용.

| 테이블 | SELECT | INSERT | UPDATE / DELETE |
|---|---|---|---|
| `workouts` | 전체 공개 | 본인 | 본인 |
| `cardio_details` | 전체 공개 | 부모 workout 소유자 | 부모 workout 소유자 |
| `workout_comments` | 전체 공개 | 본인 | 본인 or 어드민 |
| `workout_likes` / `comment_likes` | 전체 공개 | 본인 | 본인 |
| `club_feeds` | 전체 공개 | 본인 | 본인 or 클럽매니저 |
| `race_records` | 전체 공개 | 본인 | 본인 |
| `notifications` | **본인만** | **차단**(트리거) | 본인 |
| `workout_logs` | 본인만 | 본인 | 본인 |
| `daily_todos` / `todo_workouts` | 본인만 | 본인 | 본인 |
| `user_profiles` | 본인만 | 본인 | 본인 |
| `user_blocks` | 본인(blocker) | 본인 | 본인 |
| `users` | 전체(PII 컬럼 제외) | **차단**(RPC) | 본인 or 슈퍼어드민 + 플래그 트리거 |
| `clubs` | 전체 공개 | 본인이 created_by | 클럽매니저 or 어드민 |
| `club_members` | 전체 공개 | 본인 가입 or 매니저 | 본인(설정) or 매니저 + role 변경 트리거 |
| `club_mileage_configs` | 전체 공개 | 매니저 | 매니저 |
| `club_workout_mileage` | 전체 공개 | **차단**(트리거) | **차단** |
| `hall_of_fame` | 전체 공개 | 매니저 | 매니저 |
| `challenges` | 전체 공개 | 매니저 | 매니저 or 생성자 |
| `challenge_participants` | 클럽원 | 본인 | 본인 or 매니저 |
| `reports` | **어드민만**(`OR true` 제거) | 본인이 reporter | 어드민 |
| `system_settings` | 전체 공개 | 슈퍼어드민 | 슈퍼어드민 |
| `workout_types` | 전체 공개 | 어드민 | 어드민 |
| `app_releases` | 전체 공개(다운로드 페이지) | 어드민 | 어드민 |
| `demo_users` | 전체 공개(게스트 진입) | 어드민 | 어드민 |
| `audit_logs` | 본인 or 어드민 | **차단**(service_role) | **차단** |

### 3-3. 컬럼 권한으로 못 막는 두 지점 → 트리거 + RPC

**(a) 관리자 플래그 자가 승격 차단** — RLS 는 컬럼 단위 판정을 못 하므로 트리거로 막는다.
사용자가 원한 시맨틱("클라이언트가 직접 쓰되 슈퍼어드민 토큰일 때만")을 그대로 유지하므로
[userService.ts:139](../../src/services/userService.ts) 는 **코드 변경 불필요**.

```sql
CREATE FUNCTION public.guard_users_privileged_columns() RETURNS trigger AS $$
BEGIN
  IF (NEW.is_admin, NEW.is_sub_admin, NEW.is_super_admin) IS DISTINCT FROM
     (OLD.is_admin, OLD.is_sub_admin, OLD.is_super_admin)
     AND NOT public.app_is_super_admin() THEN
    RAISE EXCEPTION '관리자 권한 변경은 슈퍼어드민만 가능합니다';
  END IF;
  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id AND NOT public.app_is_super_admin() THEN
    RAISE EXCEPTION 'auth_id 는 변경할 수 없습니다';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

`club_members.role` 자가 승격도 동일 패턴으로 막는다 (본인이 자기 `role` 을 manager 로 못 바꾸게).

**(b) 본인/어드민 PII 조회 RPC** — 컬럼 GRANT 는 행에 무관하므로, 본인 PII 도 함께 막힌다.
아래 RPC 로 되돌려준다.

| RPC | 용도 | 대체 대상 |
|---|---|---|
| `get_my_account()` | 본인 email·phone 등 전체 | [AuthContext.tsx:40,61](../../src/contexts/AuthContext.tsx), [More.tsx:407](../../src/pages/More.tsx), [FeedbackModal.tsx:29](../../src/components/FeedbackModal.tsx) |
| `admin_list_users(...)` | 어드민 사용자 목록/검색(email·phone 포함) | [userService.ts:29,67](../../src/services/userService.ts), [AdminUserManagement.tsx](../../src/pages/AdminUserManagement.tsx) |

> `AuthContext` 는 로그인 경로라 회귀 위험이 가장 큰 지점이다
> ([docs/deploy.md](../deploy.md) 7·8절의 로그인 사고 이력 참고). 이 부분만 별도로 검증한다.

---

## 4. 개인정보 최소화 (Phase 2 — RLS 와 분리)

RLS 로 막는 것보다 **애초에 안 받는 것**이 근본적이다. 실사용 대조 결과:

| 컬럼 | 저장 | 읽는 곳 | 판정 |
|---|---|---|---|
| `birthyear` | 198건 | **없음** | **삭제** |
| `gender` | 198건 | **없음** | **삭제** |
| `phone_number` | 198건 | 피드백 prefill, 어드민 검색 | 삭제 권장(피드백에서 직접 입력) |
| `email` | 259건 | `getAdmins()` → 클럽신청 알림 발송 | 유지 (실제 필요한 건 어드민 9명분) |
| `kakao_id` | 200건 | 레거시 계정 연결 매칭 | 연결 완료 후 제거 |
| 실명(`name`) | **0건** | 없음 | **스코프 제거** |

- **실명은 이미 저장조차 안 한다.** [KakaoLogin.tsx:17](../../src/components/KakaoLogin.tsx) 이 `name` 스코프를
  요청하는데 `link_or_create_user` 에 `p_name` 파라미터가 없다 — 동의만 받고 버리는 중.
- **동명이인 식별 걱정은 불필요.** `auth_id` 가 유일키라 동명이인이 몇 명이든 식별은 안 흔들린다.
  `kakao_id` 는 식별키가 아니라 레거시 88명을 auth 계정에 붙이는 **매칭키**로만 쓰인다.
  클럽 내 표시 구분은 `club_members.club_nickname` 이 이미 담당.

조치 순서: ① 카카오 스코프에서 `name birthyear gender`(+검토 후 `phone_number`) 제거
→ ② `link_or_create_user` 파라미터 제거 → ③ 컬럼 DROP.
③ 은 and/app 이 해당 컬럼을 읽지 않는지 확인 후에만 진행한다.

---

## 5. 적용 절차

1. 마이그레이션 작성 (`supabase/migrations/`) + 롤백 스크립트 동시 작성
2. `npm run build` 통과 확인
3. **검증 쿼리로 정책 전수 확인** — `(true)` 잔존 0건, 구세대 `auth.uid()` 판정 잔존 0건
4. 사용자 승인 후 `supabase db push` 로 prod 적용
5. 적용 직후 스모크 테스트 (아래)
6. and/app 에 스펙 공유

### 5-1. 적용 후 스모크 테스트 (반드시)

- [ ] 카카오 로그인 신규/기존 (레거시 `auth_id` NULL 계정 포함)
- [ ] 운동 기록 추가 / 수정 / 삭제, 마일리지 자동 반영
- [ ] 클럽 피드 · 댓글 · 좋아요, 알림 수신
- [ ] 클럽 설정(매니저) / 일반 멤버 접근 거부
- [ ] 어드민 페이지(사용자 목록·email 표시·권한 부여)
- [ ] 게스트 모드 `?tmp=N` 조회 가능 · 쓰기 차단
- [ ] anon 으로 `PATCH users {is_super_admin:true}` **거부되는지 직접 확인**

### 5-2. 롤백

정책 변경은 되돌릴 수 있게 이전 정책 전체를 복원하는 스크립트를 같이 만든다.
단 **롤백은 §1-2 의 무인증 권한상승 구멍을 되살리는 것**이므로, 장애 시에도
문제된 테이블만 선별 롤백하는 것을 우선한다.

---

## 6. and / app 에 전달할 계약 요약

- **쓰기는 전부 `authenticated` 전용.** 세션 만료 상태의 백그라운드 동기화는 실패한다
  → 재시도 전 세션 갱신 필요.
- **모든 쓰기는 `user_id = app_user_id()` 를 만족해야 한다.** `auth.uid()` 를 `user_id` 에
  그대로 넣으면 **거부된다** (두 값은 다르다 — §1-3).
- **`users` 의 email·phone_number·birthyear·gender·kakao_id 는 조회 불가.**
  본인 정보는 `get_my_account()` RPC 사용. 그 외 사용자는 `display_name`·`profile_image` 만.
- **`notifications` 는 본인 것만** 조회된다.
- `club_workout_mileage` · `notifications` 직접 INSERT 불가 (트리거가 생성).
- `users` 직접 INSERT 불가 (`link_or_create_user` RPC 경유).
