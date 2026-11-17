# 회원 등급 · 장식 가이드

회원 이름 주변에 붙는 **테두리 · 배경 · 배지**를 한 체계로 묶는 문서다.
명예의 전당 강조, "나" 강조, 루키 배지, 직책 배지가 화면마다 따로 만들어져 서로 충돌하고 있어서,
여기에 **등급 배지(방장 ~ 정회원)** 를 얹기 전에 규칙부터 고정한다.

> **상태: 1차 구현 (2026-11-17)** — "유산소의 모든것" 클럽 요구(유료회원 표시 차등, 5만원 이상 추가 차등)에서 출발.
> 마이그레이션 `20261117000000_member_grade_and_dues.sql` (운영 DB 적용됨), `GradeBadge` · `clubGradeService` ·
> `clubDuesService` · 회비 관리 화면(`/club/settings/:clubId/dues`).
> 1차 범위 밖: 엑셀 내보내기 "등급" 열, 2-2 B 의 나머지 하드코딩 호칭(ClubTransferOwnership · More).
>
> **회비 등급 결정 기록 (2026-11-17)**
> - 회비 등급은 **연도별**이다 — "27 정회원", "27 대회원".
> - 대회원 기준 5만원은 **그 해 낸 금액** 합계다. 누적이 아니다.
> - 올해 회비를 안 낸 회원은 **배지 없음**. 지난 연도 배지를 남기지 않는다.
> - 대회원 버블의 후원 단계(5+ … 100+)는 **가입 이후 누적** 합계다.
> - 운영진은 등급에 사람을 넣지 않고 **납부 기록(날짜 · 회원 · 금액)** 만 적는다. 등급은 자동 계산.

- 색 토큰 규칙: [design-guide_color-system.md](design-guide_color-system.md)
- 등급 데이터: `supabase/migrations/20260811080000_create_club_permissions.sql`,
  [src/services/clubPermissionService.ts](../src/services/clubPermissionService.ts)

---

## 1. 누가 누구인가 — 클럽에 기여하는 세 가지 방식

장식은 "이 사람이 클럽에 무엇을 내놓았는가"를 보여준다. 내놓는 것이 다르면 표현도 다르다.

| 축 | 누구 | 무엇을 내놓았나 | 표현 | 감성 |
|---|---|---|---|---|
| **기록** | 명예의 전당 | 마일리지. 운영진이 마일리지 우수 + 정성적 사유로 등재한다. 수상 상위권을 매달 경쟁에서 빼는 것이 목적이라, 사실상 **경쟁을 졸업한 우수자** | 금색 행 + 🏆 | 전설 · 경외 |
| **봉사** | 운영진 (방장 · 부방장) | 시간. 무료 봉사로 클럽을 운영한다 | **왕관** — 방장은 파란 배지, 부방장은 핑크 배지 위에 흰 왕관 | 카카오톡 오픈채팅에서 보던 그 왕관 |
| **봉사** | 파트장 | 시간 + 실력. 각 종목의 우수자이자 리더, 역시 무료 봉사 | **종목 로고** — 글자 없이 종목 아이콘만 | 종목의 얼굴 |
| **회비** | 대회원 · 정회원 | 그 해 회비 (5만원 이상 / 미만). 해가 바뀌면 다시 낸다 | **체크 씰** — 바이올렛. 대회원은 `+` 가 붙고 누르면 누적 후원 단계(5+, 10+ … 100+)가 버블로 뜬다. 이름에는 연도가 붙는다 — "27 대회원" | 올해의 정식 회원 · 든든함 |
| — | 일반회원 | — | 없음 | — |

### 원칙 네 줄

1. **시간이 돈보다 위.** 봉사(운영진·파트장)는 그 사람만의 상징(왕관, 종목 로고)을 크게,
   회비(대·정회원)는 모두 같은 씰을 작게. 어느 화면에서든 봉사 배지가 회비 배지보다 눈에 띄어야 한다.
2. **금색은 살 수 없다.** 금색은 기록으로 얻는 명예의 전당 전용이다. 왕관도 금색으로 칠하지 않는다.
3. **한 사람 한 배지.** 등급 사다리에서 가장 높은 것 하나만 보인다.
4. **등급은 행 테두리·배경을 쓰지 않는다.** 그 자리는 검색결과 · 나 · 명전의 것이다.

---

## 2. 현황 (2026-11 전수 조사)

### 2-1. 지금 있는 장식

| 화면 | 행 테두리·배경 | 이름 옆 |
|---|---|---|
| 랭킹 전체 [Club.tsx:1191](../src/pages/Club.tsx) | 검색결과(핑크) / 명전(금) / 나(파랑) | 팀 점 · 나 · 🏆 · 루키 |
| 랭킹 내순위 [Club.tsx:1070](../src/pages/Club.tsx) | 나만 | 나 · 🏆 |
| 랭킹 회원검색 시트 [Club.tsx:1478](../src/pages/Club.tsx) | 없음 | 🏆 (인라인 스타일) |
| 명예의 전당 갤러리 | 금색 카드 | 🏆 |
| 회원관리 [ClubMembers.tsx:237](../src/pages/ClubMembers.tsx) | 명전 금색 | 방장 · 부매니저 · 🏆 명예의 전당 |
| 피드 카드 `WorkoutFeedCard` | 없음 | 없음 |
| 멤버 상세 `ClubMemberDetailModal` | 없음 | 없음 |
| 엑셀 내보내기 | 명전 행 노란색 | 없음 |

유산소의 모든것 실데이터: 회원 154명 — 방장 1 · 부방장 3 · 파트장(커스텀 등급) 3 · 명전 9.
**명전 9명 중 2명이 파트장**이라 기록 표시와 봉사 표시는 실제로 한 사람에게 겹친다.
활성 종목: 계단 · 달리기 · 등산 · 로잉 · 사이클 · 수영 · 스텝퍼 · 줄넘기.

### 2-2. 고쳐야 할 것 (등급 작업과 무관하게 이미 틀린 것)

| # | 문제 | 위치 |
|---|---|---|
| A | **검색 강조가 명전·본인 행에서 안 보인다.** 인라인 스타일은 검색 > 명전 > 나 순서인데 CSS 의 `.hof-highlight` / `.my-rank` 가 `!important` 라 인라인을 이긴다. 명전이면서 본인인 행은 CSS 선언 순서 때문에 파랑이 된다 (인라인 의도는 금색) | [Club.tsx:1191](../src/pages/Club.tsx), App.css `.ranking-item.hof-highlight` / `.my-rank` |
| B | **호칭 설정이 어디에도 반영되지 않는다.** `clubs.role_labels` 는 저장만 되고, 화면은 '방장' '부매니저' '클럽장' '멤버' 를 하드코딩 | ClubMembers · ClubTransferOwnership · More |
| C | **커스텀 등급이 설정 화면 밖에서 보이지 않는다.** 랭킹 데이터에도 없다 | `clubService.getClubRanking` |
| D | **회원관리 명전 카드 색 하드코딩** (`#FFF9E6`, `#FFD700`) — 다크에서 밝은 덩어리로 뜬다. `--row-hof-bg` / `--row-hof-border` 토큰이 이미 있다 | [ClubMembers.tsx:238](../src/pages/ClubMembers.tsx) |
| E | 루키 배지가 내순위 탭에서만 빠져 있다 | [Club.tsx:1080](../src/pages/Club.tsx) |
| F | **탈퇴·강퇴해도 커스텀 등급 배정이 남는다.** `leaveClub` / `removeMember` 가 `club_custom_role_members` 를 지우지 않고, `is_club_event_manager()` 는 클럽 멤버 여부를 확인하지 않는다 → 강퇴된 파트장이 행사 관리 권한을 계속 가진다 | `clubService.ts`, 마이그레이션 20260811080000 |

F 는 표시 문제가 아니라 **권한 문제**라 등급 배지보다 먼저 고친다.

---

## 3. 장식 채널 — 무엇이 어디를 쓰는가

한 사람에게 여러 정보가 겹치므로, 정보마다 쓸 수 있는 자리를 고정한다.

| 채널 | 담는 정보 | 한 사람당 | 색 |
|---|---|---|---|
| **행 강조** (테두리 2px + 배경) | 검색결과 · 나 · 명전 | 1개 (6절 우선순위) | 핑크 · 파랑 · 금 |
| **등급 배지** (이름 바로 뒤) | 방장 ~ 정회원 | 1개 (4절 사다리) | 파랑 · 핑크 · 잉크 · 바이올렛 |
| **뷰어 마크** | 나 | 1개 | 잉크 (파란 채움에서 변경 — 5-7) |
| **기록 마크** | 🏆 명전 · 루키 | 각 1개 | 금 · 옅은 클럽 색 |
| **팀 점** (이름 앞) | 챌린지 팀 | 1개 | 팀 색 |

### 색 예약표

새 장식을 만들 때 아래 색은 이미 주인이 있다.

| 색 | 주인 | 비고 |
|---|---|---|
| 금 `#FFD700` 계열 | 명예의 전당 | 기록으로 얻는다. 회비 등급에 쓰지 않는다 |
| 파랑 `#2196F3` 계열, 행 강조로 | 나 | "나" 배지는 더 이상 파랑이 아니다 (5-7) |
| 핑크 `--secondary-color` | 검색결과 강조 (행) | |
| **핑크 채움 `--grade-vice-bg`, 배지로** | **부방장** | 신규. 흰 왕관 대비를 위해 브랜드 핑크보다 진한 값 |
| **파랑 채움 `--grade-manager-bg`, 배지로** | **방장** | 신규. 기존 "나" 배지의 양식을 가져온다 |
| 하늘→핑크 파스텔 | 루키 | 기존 |
| **잉크 (무채색)** | **파트장 등 커스텀 직책** | 신규 |
| **바이올렛** | **회비 등급 (대회원 · 정회원)** | 신규 |
| 초록 · 빨강 | 상태색 (성공 · 에러) | |

기존 `.owner-badge`(보라 그라데이션) 와 `.admin-badge`(브랜드 그라데이션 채움 + 흰 글자, 라이트 대비 약 2:1)
는 이 표와 충돌하므로 등급 배지 도입과 함께 **폐기**한다.

---

## 4. 등급 사다리

```
방장  >  부방장  >  커스텀 등급 (sort_order 오름차순)  >  일반회원(배지 없음)
```

유산소의 모든것 목표 구성:

| 순서 | 등급 | 축 | 종류 | 배지 스타일 |
|---|---|---|---|---|
| 1 | 방장 | 봉사 | 기본 (`club_members.role = 'manager'`) | `manager` |
| 2 | 부방장 | 봉사 | 기본 (`'vice-manager'`) | `vice` |
| 3 | 파트장 (종목별) | 봉사 | 커스텀 · 권한 `manage_events` | `title` + 종목 아이콘 |
| 4 | **{yy} 대회원** (올해 납부 합계 5만원 이상) | 회비 | **납부 기록으로 자동 계산** | `tier_strong` |
| 5 | **{yy} 정회원** (올해 납부 합계 5만원 미만) | 회비 | **납부 기록으로 자동 계산** | `tier_soft` |
| 6 | 일반회원 | — | 기본 | 없음 |

봉사자는 회비를 내지 않으므로 봉사 등급과 회비 등급은 원래 겹치지 않는다. 겹치게 배정되면 봉사가 이긴다.
이 문서는 방장 · 부방장이라고 부르지만, 화면에 나오는 이름은 호칭 설정(`role_labels`)을 따른다 (지금은 "클럽장" · "부클럽장").

### 결정 규칙

```ts
function resolveGrade(role, customRoles /* 이 회원이 속한 것, sort_order 순 */, dues /* 10-1 RPC 결과 */, labels) {
  if (role === 'manager')      return { kind: 'manager', label: labels.manager };
  if (role === 'vice-manager') return { kind: 'vice',    label: labels['vice-manager'] };
  const top = customRoles.find(r => r.badge_style === 'title');
  if (top) return { kind: 'title', label: top.name, icon: top.badge_icon };
  if (dues) {                                   // 올해 납부 기록이 있을 때만 행이 온다
    const yy = String(dues.year % 100).padStart(2, '0');
    return dues.tier === 'strong'
      ? { kind: 'tier_strong', label: `${yy} 대회원`, step: dues.step }
      : { kind: 'tier_soft',   label: `${yy} 정회원` };
  }
  return null;
}
```

- 회비 등급(4 · 5)은 **커스텀 등급이 아니다.** 권한관리 화면에서 만들거나 사람을 넣지 않고,
  회비 관리 화면(10-4)의 납부 기록에서 자동으로 나온다.
- 커스텀 등급은 `badge_style = 'title'` 일 때만 배지가 보인다. `'none'` 이면 권한만 주고 표시는 안 한다.
- `sort_order` 가 같으면 `created_at` 이 빠른 쪽이 위.
- 회비 등급 이름은 **모든 클럽원에게 보인다.** 그래서 금액이 드러나는 "유료(5만↑)" 대신
  **대회원 / 정회원** 으로 정했다. 1차에서는 코드 고정이다.
- "올해" 는 한국 시간 기준 달력 연도다. **1월 1일 0시에 전원의 회비 배지가 한꺼번에 사라지고**,
  운영진이 새해 납부를 기록하는 순서대로 다시 붙는다.
- 배지가 없는 6번은 호칭 설정(`role_labels.member`)상 이름이 "회원" 이다.
  "정회원" 과 헷갈리므로 "일반회원" 으로 바꾸는 것을 권한다.

---

## 5. 등급 배지 스펙

### 5-1. 다섯 가지 스타일

| kind | 대상 | 아이콘 | 바탕 | 아이콘·글자 색 | 테두리 |
|---|---|---|---|---|---|
| `manager` | 방장 | 왕관 (면) | `var(--grade-manager-bg)` 파랑 | `var(--grade-crown)` 흰색 | — |
| `vice` | 부방장 | 왕관 (면) | `var(--grade-vice-bg)` 핑크 | `var(--grade-crown)` 흰색 | — |
| `title` | 파트장 등 | 종목 로고 | 투명 | `var(--text-primary)` | 1px `var(--text-secondary)` |
| `tier_strong` | 대회원 | 체크 씰 + `+` | `var(--grade-tier-strong-bg)` | `var(--grade-tier-strong-fg)` | — |
| `tier_soft` | 정회원 | 체크 씰 | `var(--grade-tier-soft-bg)` | `var(--grade-tier-soft-fg)` | 1px `var(--grade-tier-soft-fg)` |

읽는 법:

- **운영진은 색칠한 배지 위의 흰 왕관.** 카카오톡 오픈채팅의 방장·부방장 왕관과 이어지게 한다
  (클럽 대부분이 오픈채팅에서 넘어왔다). 방장은 파랑, 부방장은 핑크 — 앱의 브랜드 두 색 계열이다.
- **왕관은 테두리 없는 흰색 면.** 선으로 그린 왕관이 아니라 속이 찬 한 덩어리다.
  금색은 명전 전용이라 쓰지 않는다.
- **파란 채움은 원래 "나" 배지의 양식이었다.** 방장이 이 양식을 가져가고, "나" 배지는 잉크로 바꾼다 (5-7).
  파란 채움 배지가 둘이면 랭킹에서 방장과 나를 혼동한다.
- **파트장은 종목 로고만.** 글자를 빼고 종목 아이콘으로 말한다. 실력으로 선 사람이라 색은 잉크.
- **회비 등급은 체크 씰.** "인증된 정식 회원" 이라는 뜻이다. 보석 같은 사치 기호는 쓰지 않는다 —
  회비는 클럽을 받치는 일이지 등급을 사는 일이 아니다. 대회원은 채움, 정회원은 틴트로 무게만 다르다.

아이콘은 전부 `lucide-react`. 이모지는 기기마다 모양이 달라 쓰지 않는다.

| 용도 | 아이콘 |
|---|---|
| 운영진 | `Crown` + `fill="currentColor"` — 선과 면이 같은 흰색이라 한 덩어리로 보인다 |
| 회비 등급 씰 | `BadgeCheck` |
| 종목 — 달리기 / 사이클 / 수영 / 등산 | `Footprints` / `Bike` / `Waves` / `Mountain` |

### 5-2. 두 가지 크기

| | compact | full |
|---|---|---|
| 쓰는 곳 | 랭킹(전체·내순위·검색), 피드 | 회원관리, 멤버 상세 헤더 |
| 봉사 (`manager` `vice` `title`) | **아이콘 표식만** — 20×20 원, 아이콘 13px | 알약 — 높이 22, 아이콘 + 등급 이름 11px/700. 운영진은 왼쪽에 compact 표식을 그대로 넣고 글자는 잉크 |
| 회비 (`tier_*`) | **아이콘 표식만** — 정회원 16×16 원, 대회원은 씰 + `+` 라 높이 16 · 폭 약 26. 아이콘 11px | 알약 — 높이 22, 패딩 8, 아이콘 12px + 등급 이름 11px/700. 이름에 연도가 붙고, 대회원은 뒤에 후원 단계 ("27 대회원 100+") |

- compact 는 전부 글자 없는 표식이다. 랭킹에 같은 글자가 줄줄이 반복되지 않고, 이름 줄 폭도 거의 먹지 않는다.
  뜻은 표식을 눌러 뜨는 버블이 알려준다 (5-8).
- **봉사 표식이 회비 표식보다 크다** (20 vs 16). 원칙 1 을 크기로 지킨다 —
  대회원의 채운 바이올렛이 왕관보다 먼저 눈에 들어오면 안 된다.
- 운영진의 full 알약은 바탕을 `--card-bg`, 테두리를 배지 색 1px 로 두고 글자를 잉크로 쓴다.
  파랑·핑크 바탕에 흰 글자를 얹으면 11px 글자 대비가 3.7:1 로 기준(4.5:1)에 못 미친다.
- 등급 이름은 full(회원관리 · 멤버 상세)에서 읽힌다. 표식에는 반드시 `title` / `aria-label` 로 등급 이름을 넣는다.
- **종목 아이콘이 없는 `title` 등급**(다른 클럽의 "총무" 등)은 표식으로 뜻이 전달되지 않으므로
  compact 에서도 글자 알약으로 보인다 — 높이 18, 패딩 6, 10px/700, 최대 5자 후 말줄임.

### 5-3. 한 줄 소개 (full, 멤버 상세 헤더 전용)

멤버 상세에서 이름 아래에 등급을 한 문장으로 풀어 준다. 배지가 "무엇"이면 이 줄은 "왜"다.

| kind | 문구 |
|---|---|
| `manager` · `vice` | 클럽을 위해 봉사하는 운영진 |
| `title` (종목 아이콘 있음) | {종목} 파트를 이끄는 리더 — 예: "달리기 파트를 이끄는 리더" |
| `title` (아이콘 없음) | 클럽을 위해 봉사하는 {등급 이름} |
| `tier_strong` | 20{yy}년 클럽을 든든하게 받치는 대회원 |
| `tier_soft` | 20{yy}년 클럽과 함께하는 정회원 |

명전은 기존 `hof_reason` 을 그대로 쓴다. 문구는 1차에서 코드 고정이고, 클럽별로 고치는 기능은 넣지 않는다.

### 5-4. 토큰 (App.css `:root` / `[data-theme='dark']` 에 추가)

```css
:root {
  /* 회비 등급 배지 — 금색(명전)과 겹치지 않게 바이올렛. 행 배경(나/검색결과) 위 대비까지 검증한 값 */
  --grade-tier-strong-bg: #6D3FE0;
  --grade-tier-strong-fg: #FFFFFF;
  --grade-tier-soft-bg: #EFE9FF;
  --grade-tier-soft-fg: #5B34D6;

  /* 운영진 왕관 배지 — 두 테마 공통. 흰 왕관과 3:1 이상 나오도록 브랜드 하늘/핑크보다 진하게 잡은 값 */
  --grade-manager-bg: #1E88E5;
  --grade-vice-bg: #F0407A;
  --grade-crown: #FFFFFF;
}
[data-theme='dark'] {
  --grade-tier-strong-bg: #B39DFF;
  --grade-tier-strong-fg: #0F1115;
  --grade-tier-soft-bg: #36344D;
  --grade-tier-soft-fg: #CFC2FF;
}
```

왕관 배지 세 토큰은 상태색처럼 **두 테마에서 값이 같다** (`[data-theme='dark']` 에 다시 쓰지 않는다).
브랜드 원색(`--primary-color` `#4FC3F7`, `--secondary-color` `#FF6B9D`)을 그대로 쓰지 않는 이유:
흰 왕관과의 대비가 1.98 / 2.68 로 3:1 에 못 미친다.
파트장 배지는 `--text-primary` / `--text-secondary` 만 써서 새 토큰이 필요 없다.

**틴트를 반투명(`rgba`)으로 만들지 말 것.** 배지는 금색·파랑·핑크 행 배경 위에 얹히는데,
반투명 바이올렛은 파랑 행 위에서 글자 대비가 4.38:1, 핑크 행 위에서 3.78:1 로 떨어진다 (실측).
그래서 `--grade-tier-soft-bg` 는 불투명 값이다.

### 5-5. 대비 실측 (WCAG, 작은 글자 기준 4.5:1 / 비문자 3:1)

| 항목 | 라이트 | 다크 |
|---|---|---|
| 방장 — 흰 왕관 on 파랑 | 3.68 | 3.68 |
| 방장 표식 vs 일반 행 배경 | 3.51 | 4.49 |
| 부방장 — 흰 왕관 on 핑크 | 3.67 | 3.67 |
| 부방장 표식 vs 일반 행 배경 | 3.51 | 4.50 |
| 종목 로고 — 가장 불리한 행 배경 위 | 6.65 (검색결과 행) | 9.25 (나 행) |
| `tier_strong` 아이콘·글자 | 6.11 | 8.26 |
| `tier_strong` 표식 vs 행 배경 — 가장 불리한 행 | 3.70 (검색결과 행) | 4.76 (나 행) |
| `tier_soft` 아이콘·글자 | 6.11 | 7.30 |
| `tier_soft` 외곽선 vs 행 배경 — 가장 불리한 행 | 4.37 (검색결과 행) | 6.64 (나 행) |

- 행 배경은 그라데이션의 진한 쪽 끝 기준. 색을 바꾸면 이 표를 다시 계산한다
  (`#7C4DFF` 는 검색결과 행 위에서 2.91:1 로 미달이라 기각했다).
- 왕관 배지가 약해지는 조합이 둘 있다 (라이트): 방장 본인이 보는 파란 "나" 행 위 2.62,
  검색결과 핑크 행 위의 부방장 2.22. 둘 다 흰 왕관이 안에서 3.7:1 로 보이고 일시적인 상태라 허용한다.
- 왕관 배지 색을 바꿀 때는 **흰 왕관 대비 3:1** 과 **일반 행 배경 대비 3:1** 을 둘 다 확인한다
  (`#2196F3` 은 일반 행 위 2.98, `#FF4081` 은 다크 "나" 행 위 3.27 로 여유가 없어 기각).

### 5-6. CSS

```css
.grade-badge {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  flex-shrink: 0; box-sizing: border-box; border-radius: 999px;
  font-size: 11px; font-weight: 700; line-height: 1; white-space: nowrap;
}
/* compact — 아이콘 표식. 봉사 20, 회비 16 */
.grade-badge--mark    { width: 20px; height: 20px; }
.grade-badge--mark.grade-badge--tier_strong,
.grade-badge--mark.grade-badge--tier_soft { width: 16px; height: 16px; }
/* 대회원 — 씰 + "+" */
.grade-badge--mark.grade-badge--tier_strong { width: auto; padding: 0 5px 0 3px; gap: 1px; }
/* 누르는 영역만 넓힌다 (5-8) */
.grade-badge--mark { position: relative; }
.grade-badge--mark::after { content: ''; position: absolute; inset: -8px; }
/* compact — 종목 아이콘 없는 title 의 글자 알약 */
.grade-badge--text    { height: 18px; padding: 0 6px; font-size: 10px; }
.grade-badge--text .grade-badge__label { max-width: 5em; overflow: hidden; text-overflow: ellipsis; }
/* full — 아이콘 + 등급 이름 */
.grade-badge--full    { height: 22px; padding: 0 8px; }

.grade-badge--manager     { background: var(--grade-manager-bg); color: var(--grade-crown); }
.grade-badge--vice        { background: var(--grade-vice-bg);    color: var(--grade-crown); }
/* 운영진 full — 종이 바탕 + 배지 색 테두리 + 잉크 글자, 왼쪽에 compact 표식 */
.grade-badge--full.grade-badge--manager,
.grade-badge--full.grade-badge--vice { background: var(--card-bg); color: var(--text-primary); padding-left: 1px; }
.grade-badge--full.grade-badge--manager { box-shadow: inset 0 0 0 1px var(--grade-manager-bg); }
.grade-badge--full.grade-badge--vice    { box-shadow: inset 0 0 0 1px var(--grade-vice-bg); }
.grade-badge--title       { box-shadow: inset 0 0 0 1px var(--text-secondary); color: var(--text-primary); }
.grade-badge--tier_strong { background: var(--grade-tier-strong-bg); color: var(--grade-tier-strong-fg); }
.grade-badge--tier_soft   { background: var(--grade-tier-soft-bg); color: var(--grade-tier-soft-fg);
                            box-shadow: inset 0 0 0 1px var(--grade-tier-soft-fg); }
```

외곽선은 전부 `border` 가 아니라 `inset box-shadow` — 스타일마다 배지 크기가 달라지지 않게.

### 5-7. "나" 배지 변경

방장 배지가 파란 채움을 쓰게 되면서, 기존 `.my-rank-badge`(파란 채움 `#2196F3` + 흰 글자)는 잉크로 바꾼다.

```css
.my-rank-badge { background: var(--text-primary); color: var(--card-bg); }   /* 기존: #2196F3 / white */
```

- "나" 의 파랑은 **행 강조**(`--row-me-bg` / `--row-me-border`)가 계속 맡는다. 배지까지 파랄 필요가 없다.
- 잉크 채움은 파란 행 위에서 오히려 더 또렷하다 — 글자 대비 10.98 (라이트) / 14.80 (다크),
  기존 흰 글자 on 파랑은 3.12 였다.
- 테마 토큰만 쓰므로 다크에서 자동으로 밝은 바탕 + 어두운 글자로 뒤집힌다.

### 5-8. 버블 — 표식을 누르면

compact 표식은 글자가 없어서, **누르면 그 자리 위에 작은 버블**이 떠서 뜻을 알려준다.
모바일에는 hover 툴팁이 없으므로 `title` 속성만으로는 부족하다.

| kind | 버블 내용 |
|---|---|
| `manager` · `vice` | 호칭 — "클럽장" |
| `title` | 등급 이름 — "달리기 파트장" |
| `tier_soft` | 등급 이름 — "27 정회원" |
| `tier_strong` | **누적 후원 단계** — "100+" (큰 글자) + "만원 이상 후원 · 27 대회원" (작은 글자) |

**대회원의 `+`** — 대회원 표식에는 씰 옆에 `+` 가 붙는다. "눌러 보면 더 있다" 는 표시이자 정회원과의 구분이다.
금액 숫자는 랭킹에 상시 노출하지 않고 버블 안에만 둔다 (원칙 1 — 금액 알약이 왕관보다 커지면 안 된다).

**후원 단계 계산** — 이 회원의 **전체 납부 기록 합계**(원)로 계산한다. 연도와 무관한 누적이다.
대회원이라는 건 올해만 5만원 이상 냈다는 뜻이므로 누적 합계도 항상 5만원 이상이다.

```ts
function donationStep(totalWon: number): string {
  const man = Math.floor(totalWon / 10000);
  if (man < 10) return '5+';
  return `${Math.floor(man / 10) * 10}+`;     // 10+, 20+, … 100+, 110+ …
}
```

| 누적 합계 | 단계 |
|---|---|
| 5만 ~ 10만 미만 | 5+ |
| 10만 ~ 20만 미만 | 10+ |
| 100만 ~ 110만 미만 | 100+ |

정확한 금액은 클럽원에게 보내지 않는다 — 10-1 의 RPC 가 단계 숫자만 돌려준다.

**동작**

- 표식은 `<button>`. 누르면 버블이 열리고, 다시 누르거나 바깥을 누르거나 스크롤하면 닫힌다. 2.5초 뒤 자동으로 닫힌다.
- 한 번에 하나만 열린다.
- **`e.stopPropagation()` 필수** — 랭킹 행과 피드 카드는 통째로 눌리는 영역이라(멤버 상세가 열림)
  막지 않으면 버블 대신 상세가 열린다.
- 표식은 16~20px 로 작으므로 `::after { inset: -8px }` 로 **누르는 영역만** 32px 이상으로 넓힌다. 보이는 크기는 그대로.
- full(회원관리 · 멤버 상세)에서는 이름이 이미 보이므로 버블이 없다. 대회원만 알약 안에 단계를 같이 쓴다 — "대회원 100+".

**구현 제약** ([CLAUDE.md](../CLAUDE.md) Android WebView 규칙)

- 버블은 `createPortal(..., document.body)` + `position: fixed`. 랭킹 행에 `overflow`/`transform` 이 있어
  행 안에 `absolute` 로 두면 잘리거나 z-index 가 깨진다.
- 위치는 `getBoundingClientRect()` 로 계산해 인라인 `top`/`left` 로 준다. `vh` 단위 금지.
- 화면 좌우 끝에서 잘리지 않게 `left` 를 8px ~ `window.innerWidth - 버블폭 - 8px` 로 가둔다.
  표식이 화면 위쪽에 붙어 있으면 버블을 아래로 뒤집는다.
- 색은 `background: var(--text-primary); color: var(--card-bg)` — 테마에 따라 자동 반전. 꼬리는 6px 삼각형.

---

## 6. 행 강조 규칙

### 우선순위: 검색결과 > 나 > 명전

| 순위 | 상태 | 이유 |
|---|---|---|
| 1 | 검색결과 | 사용자가 방금 요청한 일시적 강조. 안 보이면 기능이 고장난 것 |
| 2 | 나 | 랭킹의 1차 용도가 "내 위치 찾기" |
| 3 | 명전 | 상시 표시. 밀려나도 🏆 마크로 계속 보인다 |

### 구현: 상태 하나, 클래스 하나

```tsx
const rowState =
  member.user_id === highlightedUserId ? 'found'
  : isMyRank ? 'me'
  : member.is_hall_of_fame ? 'hof'
  : null;

<div className={`ranking-item clickable${rowState ? ` ranking-item--${rowState}` : ''}`}>
```

```css
.ranking-item--found { background: var(--row-found-bg); border: 2px solid var(--row-found-border); }
.ranking-item--me    { background: var(--row-me-bg);    border: 2px solid var(--row-me-border); }
.ranking-item--hof   { background: var(--row-hof-bg);   border: 2px solid var(--row-hof-border); }
```

- 인라인 `style={{ background, borderColor, borderWidth }}` 와 `.hof-highlight` / `.my-rank` 의
  `!important` 는 **삭제**한다. 클래스가 두 개 붙고 인라인까지 겹치는 구조가 2-2 A 버그의 원인이다.
- **등급으로 행을 강조하지 않는다.** 이미 세 상태가 한 자리를 다투고 있다.
- 내순위 탭은 7행짜리 맥락 뷰라 '나' 만 강조한다 (명전 행 강조 없음, 🏆 마크만).
- 회원관리의 명전 카드는 `--row-hof-bg` / `--row-hof-border` 토큰을 쓴다 (2-2 D).

---

## 7. 화면별 매트릭스

| 화면 | 행 강조 | 등급 배지 | 나 | 🏆 | 루키 | 팀 점 |
|---|---|---|---|---|---|---|
| 랭킹 전체 | 검색 / 나 / 명전 | compact | ● | ● | ● | ● |
| 랭킹 내순위 | 나 | compact | ● | ● | ● (추가) | — |
| 랭킹 회원검색 시트 | — | compact | — | ● | — | — |
| 클럽 피드 카드 | — | compact | — | — | — | — |
| 멤버 상세 헤더 | — | full + 한 줄 소개 | — | — | — | — |
| 회원관리 | 명전 | full | — | full (`🏆 명예의 전당`) | — | — |
| 명예의 전당 갤러리 | 금색 카드 | — | — | ● | — | — |
| 엑셀 내보내기 | 명전 행 노랑 | "등급" 열 (글자) | — | — | — | — |

**표시하지 않는 곳** — 등급은 그 클럽 안에서만 의미가 있다.

- 홈 통합 피드, 알림, 댓글: 여러 클럽이 섞이는 화면이라 표시하지 않는다.
  `WorkoutFeedCard` 는 두 곳에서 같이 쓰이므로 배지를 **prop 으로 받고**, 클럽 피드에서만 넘긴다.
- 행사 참가자 · 체크인 승인 · 팀 배정 · 멤버 선택 시트: 운영 작업 화면이라 1차 범위 밖.

---

## 8. 이름 줄 구조

### 순서

```
[팀 점] 이름 [등급] [나] [🏆] [루키]
```

등급이 이름 바로 뒤 — "누구인가"(등급)가 "나와의 관계"(나), "무엇을 했나"(기록)보다 먼저다.

### 잘리는 건 이름이지 배지가 아니다

지금 `.ranking-name` 은 통째로 `overflow: hidden; text-overflow: ellipsis` 라
닉네임이 길면 **뒤에 붙은 배지가 먼저 잘려 사라진다.** 이름만 따로 감싸서 줄인다.

```tsx
<div className="ranking-name">
  {teamDot}
  <span className="member-name-text">{member.display_name}</span>
  <GradeBadge grade={gradeOf(member.user_id)} />
  {isMyRank && <span className="my-rank-badge">나</span>}
  {member.is_hall_of_fame && <span className="hof-badge-inline">🏆</span>}
  {showRookie && <span className="rookie-badge">루키</span>}
</div>
```

```css
.ranking-name { display: flex; align-items: center; gap: 4px; min-width: 0; }
.member-name-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ranking-name > :not(.member-name-text) { flex-shrink: 0; margin-left: 0; }
```

기존 배지들의 `margin-left`(6~8px)는 `gap` 과 이중으로 벌어지므로 이름 줄 안에서는 0 으로 둔다.

### 폭 예산 (360px 화면, 랭킹 행)

이름 영역은 약 148px. 배지 최대 폭: 등급 표식 26(대회원) · 나 24 · 🏆 20 · 루키 32.
넷이 다 붙어도 115px 남짓이라 이름 자리가 남는다 — compact 를 전부 표식으로 둔 덕이다.
종목 아이콘이 없는 글자 알약(5-2)만 5자에서 자른다.

---

## 9. 파트장을 종목별로 나누기

파트장은 "각 종목의 우수자이자 리더" 이고 배지는 종목 로고 하나뿐이므로, 등급에 종목이 있어야 한다.
지금은 "파트장" 등급 하나에 3명이 들어 있어 누가 어느 종목인지 알 수 없다.

- 등급을 **종목마다 하나씩** 만들고, 등급마다 종목 아이콘(`badge_icon`)을 고른다.
- 등급 이름은 "달리기 파트장" 처럼 종목을 넣어 짓는다. compact 에는 글자가 안 나오므로 길이 제한이 없고,
  회원관리 · 멤버 상세(full)에서 그대로 읽힌다.
- 한 줄 소개(5-3)는 아이콘에서 종목 이름을 가져온다 — "달리기 파트를 이끄는 리더".
- 아이콘 프리셋은 달리기 · 사이클 · 수영 · 등산 4종. 나머지 종목(로잉 · 계단 · 스텝퍼 · 줄넘기)
  파트장이 생기면 **프리셋을 먼저 늘린다** — 아이콘이 없으면 글자 알약으로 떨어져(5-2) 다른 파트장과 모양이 달라진다.

---

## 10. 데이터 · 코드 구조

### 10-1. 마이그레이션

**새 테이블은 하나다** — 회비 납부 기록. 날짜별 목록과 회원별 목록은 같은 테이블을 다르게 정렬한 화면일 뿐이다.

```sql
-- 커스텀 등급: 배지 표시 여부 + 종목 아이콘
ALTER TABLE public.club_custom_roles
  ADD COLUMN IF NOT EXISTS badge_style text NOT NULL DEFAULT 'none'
    CHECK (badge_style IN ('none', 'title')),
  ADD COLUMN IF NOT EXISTS badge_icon text
    CHECK (badge_icon IS NULL OR badge_icon IN ('run', 'bike', 'swim', 'hike'));

-- 회비 납부 기록 — 한 번 낸 것이 한 행
CREATE TABLE IF NOT EXISTS public.club_dues_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id),
  season_year smallint NOT NULL,                  -- 어느 해 회비인가 (12월에 내년 회비 선납 → 내년)
  paid_on     date NOT NULL,                      -- 실제 받은 날
  amount      int  NOT NULL CHECK (amount > 0),   -- 원 단위
  memo        text,
  created_by  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_dues_club_year ON public.club_dues_payments(club_id, season_year);
CREATE INDEX IF NOT EXISTS idx_club_dues_club_user ON public.club_dues_payments(club_id, user_id);
```

- **`season_year` 를 `paid_on` 에서 뽑지 않고 따로 둔다.** 12월에 내년 회비를 미리 받는 경우가 있다.
  입력할 때 기본값은 `paid_on` 의 연도, 운영진이 바꿀 수 있다.
- **금액은 원 단위.** 장부라서 3만원 · 4만 5천원 같은 실제 금액이 그대로 남아야 한다. 만원 환산은 표시할 때만.
- 회원이 탈퇴 · 강퇴돼도 **기록은 지우지 않는다** (장부). 배지는 클럽 회원에게만 계산되므로 자연히 사라지고,
  다시 가입하면 누적이 이어진다.

**RLS** — 장부 원본은 금액이 그대로 보이므로 좁게 연다.

| 동작 | 누가 |
|---|---|
| 조회 | 방장 · 부방장, **본인** (내 납부 내역) |
| 추가 · 수정 · 삭제 | 방장 · 부방장 |

**배지용 RPC** — 클럽원 누구나 호출하지만 금액은 돌려주지 않는다.

```sql
-- 반환: 올해 납부 기록이 있는 현재 클럽 회원만
--   user_id, year(올해), tier('strong' | 'soft'), step(누적 단계 숫자, strong 일 때만 — 예: 100)
CREATE OR REPLACE FUNCTION public.get_club_dues_badges(p_club_id uuid)
RETURNS TABLE (user_id uuid, year int, tier text, step int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$ ... $fn$;
```

- "올해" = `extract(year from now() AT TIME ZONE 'Asia/Seoul')`. 클라이언트 시계를 믿지 않는다.
- 호출자가 그 클럽 회원이 아니면 빈 결과.
- 기본값과 빈 테이블이라 **배포 직후엔 아무것도 달라지지 않는다.**
- staging 웹도 prod DB 를 쓴다 — 적용하는 순간 운영에 반영된다.

### 10-2. 서비스 · 훅 · 컴포넌트

```ts
// src/services/clubGradeService.ts
export type GradeKind = 'manager' | 'vice' | 'title' | 'tier_strong' | 'tier_soft';
export type GradeIcon = 'run' | 'bike' | 'swim' | 'hike';
export interface MemberGrade { kind: GradeKind; label: string; icon?: GradeIcon | null; step?: number; }

/** 배지가 있는 회원만 담긴 맵. 호칭 · 운영진 · 표시 등급 · 등급 배정 · 회비 RPC 를 병렬로 1회. */
getGradeMap(clubId: string): Promise<Map<string, MemberGrade>>
```

```ts
// src/services/clubDuesService.ts — 회비 관리 화면 전용 (운영진)
listPayments(clubId, { year?, userId? }): Promise<DuesPayment[]>
addPayment({ clubId, userId, seasonYear, paidOn, amount, memo }): Promise<void>
updatePayment(id, patch): Promise<void>
deletePayment(id): Promise<void>
```

```ts
// src/hooks/useClubGrades.ts
const { gradeOf } = useClubGrades(clubId);   // gradeOf(userId) → MemberGrade | null
```

```tsx
// src/components/GradeBadge.tsx
<GradeBadge grade={gradeOf(userId)} size="compact" />   // grade 가 null 이면 아무것도 안 그림
<GradeTagline grade={gradeOf(userId)} />                // 5-3 한 줄 소개 (멤버 상세 전용)
// 버블(5-8)은 GradeBadge 안에서 처리한다 — 화면 쪽에서 따로 붙이지 않는다
```

- **화면마다 등급을 따로 조회하지 않는다.** 랭킹·피드 쿼리에 조인을 끼워 넣지 말고 맵 하나를 공유한다.
- 권한관리 · 회비 관리 화면에서 고치면 맵 캐시를 무효화한다.
- 배지 모양을 화면에서 직접 그리지 않는다 — `.owner-badge` 처럼 화면별 클래스가 다시 생기면
  이 문서의 의미가 없어진다.

### 10-3. 권한관리 화면 변경

커스텀 등급 카드에 세 가지를 추가한다. 회비 등급은 여기서 다루지 않는다.

- **배지 표시** 선택: 없음 / 직책 — 선택지 옆에 실제 배지 미리보기
- **종목 아이콘** 선택 (직책일 때만): 없음 / 달리기 / 사이클 / 수영 / 등산
- **순서 변경** ▲▼ — 저장할 때 `sort_order` 를 0..n-1 로 다시 매긴다
  (지금은 생성 시 `customRoles.length` 를 쓰기 때문에 삭제 후 추가하면 값이 겹친다)

자유 색상 선택은 넣지 않는다 ([design-guide_color-system.md](design-guide_color-system.md) 5절 — 대비 사고).

### 10-4. 회비 관리 화면 (신규, 운영진 전용)

클럽 설정 > **회비 관리**. 맨 위에 연도 선택(기본 올해)과 요약 한 줄:
"2027 · 대회원 12 · 정회원 31 · 합계 1,850,000원".

**탭 두 개 — 같은 기록, 다른 정렬**

| 탭 | 한 줄 | 정렬 | 누르면 |
|---|---|---|---|
| 날짜별 | 날짜 · 회원 · 금액 · 메모 | 최근 날짜 먼저 | 그 기록 수정 / 삭제 |
| 회원별 | 회원 · 올해 합계 · 배지 미리보기 · 누적 단계 | 올해 합계 큰 순 | 그 회원의 전체 납부 내역 (연도별로 묶음) |

회원별 탭에는 **올해 아직 안 낸 회원도 맨 아래에 회색으로** 나온다 — 갱신 안내 대상을 찾는 용도.

**납부 추가 시트** (바텀시트 — [design-guide_bottom-sheet.md](design-guide_bottom-sheet.md) 2-2 왼쪽 정렬 폼 패턴)

| 필드 | 입력 | 기본값 |
|---|---|---|
| 회원 | `MemberPickerSheet` | — |
| 받은 날 | `DatePickerSheet` | 오늘 |
| 회비 연도 | 연도 선택 | 받은 날의 연도. 12월이면 "내년 회비인가요?" 한 줄 안내 |
| 금액 | 숫자 (원) + 빠른 버튼 1만 · 3만 · 5만 · 10만 | — |
| 메모 | 한 줄 | 비움 |

저장 버튼 위에 **저장 후 배지 미리보기**를 보여준다 — "이 기록으로 27 대회원이 됩니다 (올해 합계 5만원)".
금액을 잘못 넣으면 여기서 바로 보인다.

멤버 상세(운영진이 볼 때)에도 그 회원의 납부 내역으로 가는 링크를 둔다. 본인은 자기 내역만 볼 수 있다.

---

## 11. 엣지 케이스

| 상황 | 처리 |
|---|---|
| 등급 여러 개 | 사다리 최상위 하나 |
| 정회원 → 대회원 승급 | 올해 추가 납부를 기록하면 합계가 5만원을 넘는 순간 자동으로 바뀐다 |
| 명전 + 등급 | 둘 다 보인다 (채널이 다름) — 금색 행 + 등급 배지 + 🏆 |
| 등급 이름이 김 (최대 20자) | compact 는 표식이라 무관 (아이콘 없는 글자 알약만 5자 말줄임). full 은 전체 표시 |
| 한 사람이 두 종목 파트장 | 순서가 위인 종목 하나만 보인다 |
| 새해 (1월 1일) | 전원의 회비 배지가 사라진다. 새해 납부를 기록하면 다시 붙는다 |
| 12월에 내년 회비 선납 | 회비 연도를 내년으로 기록 — 올해 배지에는 반영되지 않고 1월 1일부터 보인다 |
| 26년 3만 + 27년 3만 | 27 정회원 (그 해 기준) |
| 잘못 입력 | 날짜별 탭에서 그 기록을 수정 · 삭제. 음수 금액(환불)은 받지 않는다 |
| 봉사자가 회비도 냄 | 봉사 배지만 보인다. 납부 기록은 남는다 |
| 탈퇴·강퇴 | 커스텀 등급 배정은 지운다 (2-2 F). **납부 기록은 남긴다** — 재가입하면 누적이 이어진다 |
| 등급 삭제 | `ON DELETE CASCADE` 로 배정도 사라짐 — 배지도 즉시 사라진다 |

---

## 12. 구현 순서

1. **선행 정리** (등급과 무관, 단독 배포 가능)
   - 2-2 F: 탈퇴·강퇴 시 등급 배정 삭제 + `is_club_event_manager()` 에 멤버 여부 확인
   - 2-2 A: 행 강조 단일 클래스화 (6절)
   - 2-2 D · E: 회원관리 명전 토큰화, 내순위 루키 배지
2. **등급 기반**: 마이그레이션 → `clubGradeService` → `GradeBadge` → 권한관리 화면
3. **회비**: `club_dues_payments` + RPC → `clubDuesService` → 회비 관리 화면(10-4)
4. **화면 부착**: 랭킹 3곳(이름 줄 구조 변경 포함) → 회원관리(`.owner-badge` `.admin-badge` 폐기,
   2-2 B 호칭 반영) → 멤버 상세(한 줄 소개 포함) → 클럽 피드
5. **유산소의 모든것 설정**: 파트장을 종목별 등급으로 나누고 배지 켜기 → 올해 납부 내역 입력 →
   호칭 "회원" 을 "일반회원" 으로

---

## 13. 검증

눈으로만 보지 말고 실측한다. 라이트/다크 양쪽.

```js
// ① 배지가 이름 줄 밖으로 잘린 행 (0 이어야 함) — 360px 폭에서
[...document.querySelectorAll('.ranking-name')].filter(n => {
  const right = n.getBoundingClientRect().right + 0.5;
  return [...n.querySelectorAll('.grade-badge, .my-rank-badge, .rookie-badge, .hof-badge-inline')]
    .some(b => b.getBoundingClientRect().right > right);
}).length;
```

```js
// ② 한 사람에게 등급 배지가 2개 이상 붙은 행 (0 이어야 함)
[...document.querySelectorAll('.ranking-item, .member-card, .feed-card-wrapper')]
  .filter(r => r.querySelectorAll('.grade-badge').length > 1).length;
```

```js
// ③ 행 강조 클래스가 2개 이상 붙은 행 (0 이어야 함)
[...document.querySelectorAll('.ranking-item')]
  .filter(r => [...r.classList].filter(c => /^ranking-item--(found|me|hof)$/.test(c)).length > 1).length;
```

대비는 [design-guide_color-system.md](design-guide_color-system.md) 4절 STEP 3 스크립트로 확인.

### 체크리스트

- [ ] 랭킹 한 화면에서 봉사 표식(왕관 · 종목 로고)이 회비 표식(씰)보다 먼저 눈에 들어온다
- [ ] 명전 회원을 검색하면 행이 핑크로 바뀐다 / 나를 검색해도 바뀐다
- [ ] 명전이면서 파트장인 회원: 금색 행 + 종목 로고 + 🏆 가 동시에 보인다
- [ ] 긴 닉네임에서 이름이 줄고 배지는 온전하다 (360px)
- [ ] 왕관 배지는 라이트·다크에서 같은 파랑/핑크 바탕 + 흰 왕관이다
- [ ] "나" 배지가 잉크색이고, 파란 채움 배지는 방장 왕관뿐이다
- [ ] 표식을 누르면 버블이 뜨고 **멤버 상세는 열리지 않는다** (랭킹 · 피드 둘 다)
- [ ] 대회원 버블: 누적 7만 → "5+", 10만 → "10+", 105만 → "100+"
- [ ] 올해 3만 + 2만 두 번 기록 → 두 번째 저장 순간 정회원에서 대회원으로 바뀐다
- [ ] 회비 연도를 내년으로 기록한 선납은 올해 배지에 안 잡힌다
- [ ] 일반 회원 계정으로 `club_dues_payments` 를 직접 조회하면 자기 기록만 나온다 / RPC 응답에 금액이 없다
- [ ] 화면 오른쪽 끝·맨 윗줄의 표식에서도 버블이 잘리지 않는다
- [ ] 스크롤하면 버블이 닫힌다 (떠다니지 않는다)
- [ ] 홈 통합 피드에는 등급 배지가 없다
- [ ] 파트장 등급 `badge_style` 을 '없음' 으로 바꾸면 그 회원은 다음 서열 배지(회비 등급 또는 없음)로 내려간다
- [ ] `npm run build` 통과

---

## 14. 기각한 대안

| 대안 | 기각 이유 |
|---|---|
| 등급별 행 테두리 | 검색·나·명전에 이어 네 번째 경쟁자. 지금도 충돌 버그가 있다 |
| 회비 등급에 금·은 | 금색은 기록으로 얻는 명전 전용. 회비로 같은 색을 얻으면 명전의 의미가 흐려진다 |
| 회비 등급에 보석 아이콘 | "등급을 샀다" 는 인상. 무료 봉사자보다 화려해져 원칙 1 과 어긋난다 |
| 랭킹에 후원 금액 상시 표시 ("100+" 알약) | 금액 알약이 왕관보다 커져 원칙 1 과 어긋나고, 금액이 줄줄이 보이는 부담. `+` 를 눌렀을 때만 버블로 |
| 왕관을 금색으로 (카카오톡처럼) | 금색은 명전 전용. 왕관은 흰색 면, 바탕이 파랑/핑크 |
| 왕관 배지를 테두리형으로 (흰 바탕 + 색 테두리 + 잉크 왕관) | 하늘·핑크 테두리는 라이트에서 대비 2~2.8:1 로 약하다. 색칠한 바탕 + 흰 왕관이 더 또렷하고 카카오톡과 닮았다 |
| "나" 배지를 파란 채움 그대로 | 방장 왕관과 같은 양식이 되어 랭킹에서 혼동된다 (5-7) |
| 운영진을 무채색 글자 배지로 | 관리자 표시처럼 차갑다. 봉사자가 회비 회원(색 있음)보다 밋밋해진다 |
| 운영진을 클럽 색 그라데이션 테두리 글자 배지로 | 회원들에게 익숙한 건 카카오톡 오픈채팅의 왕관이다. 방장·부방장 구분도 약했다 |
| 반투명 바이올렛 틴트 | 파랑·핑크 행 위에서 글자 대비 미달 (5-4) |
| 자유 색상 선택 | 테마·행 배경 조합마다 대비 보장 불가 |
| 봉사 + 회비 배지 동시 표시 | 한 사람 한 배지 원칙. 봉사자는 회비를 내지 않아 겹칠 일도 없다 |
| 파트장 배지에 글자 넣기 | 랭킹 폭을 먹고 같은 글자가 반복된다. 종목 로고가 더 빨리 읽힌다 |
| 아바타 링으로 등급 표시 | 36px 아바타의 2px 링은 행 테두리·팀 점과 구분되지 않고, 색 예약표를 다시 깬다 |
| 닉네임 글자색 변경 | 글자색은 행 배경 4종 × 테마 2종 전부에서 대비를 맞춰야 한다 |
| 회비 등급을 커스텀 등급으로 ("27 대회원" 등급을 해마다 만들고 사람을 옮김) | 해마다 수작업이 생기고 금액 기록이 없어 누적 단계를 사람이 계산해야 한다 |
| 금액을 등급 배정 행에 한 칸으로 저장 | 날짜별 내역이 없어 장부 역할을 못 하고, 추가 납부 때 합계를 덮어쓰는 실수가 난다 |
| 대회원을 누적 5만원 기준으로 | 한 번 넘으면 영원히 대회원이라 "그 해 회원" 이라는 의미가 사라진다 |
| 지난 연도 배지 유지 ("26 정회원" 계속 표시) | 회비를 안 낸 회원과 낸 회원이 둘 다 배지를 달아 구분 의미가 약해진다 |
| 납부 기록을 클럽원 전체에 공개 | 개인별 금액이 드러난다. 배지용 RPC 로 단계만 공개 |
| 화면별 쿼리에 등급 조인 | 화면마다 판정이 달라지는 현재 문제(방장/부매니저/클럽장)의 반복 |
