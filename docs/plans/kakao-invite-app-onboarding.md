# 카카오 클럽 초대 → 앱 설치 → 가입 안내 설계

2026-08-28. [Club.tsx](../../src/pages/Club.tsx) 의 클럽 초대 공유에 **앱 설치 경로 + 앱에서의
가입 절차 안내**를 붙인다. 두 축으로 나뉜다:

- **A. 보내는 쪽** — 네이티브 앱 안에서도 공유가 되게 한다 (지금 안 될 가능성 높음, §1)
- **B. 받는 쪽** — 카카오 링크를 누르면 웹이 열리고, iOS/Android 판별해 각 경로로 인계한다 (§2)

**세 프로젝트(web / and / app) 공통 스펙**이다. §4 가 and/app 요청 사항.

---

## 1. A. 보내는 쪽 — 공유 4단 폴백

### 1-1. 문제: 네이티브 앱 웹뷰 안에서 `Kakao.Share.sendDefault` 는 안 먹는다

지금 세 곳([Club.tsx:569](../../src/pages/Club.tsx), [WorkoutFeedCard.tsx:151](../../src/components/WorkoutFeedCard.tsx),
[AddWorkout.tsx:815](../../src/pages/AddWorkout.tsx))이 전부 카카오 JS SDK 를 직접 부른다.

이 SDK 는 내부적으로 `kakaolink://` 커스텀 스킴으로 카톡 앱을 띄운다. 그런데 WebView 는
**네이티브가 스킴 이동을 직접 처리해주지 않으면 그 네비게이션을 그냥 삼킨다**
(iOS `decidePolicyFor navigationAction`, Android `shouldOverrideUrlLoading`). 네이티브가 이걸
구현해뒀는지 확인이 안 됐고, 안 했다면 **앱 안에서 공유 버튼이 무반응**이다.

> 앞서 `confirm()` 이 WebView 에서 조용히 무시됐던 것과 같은 계열의 문제다
> ([useConfirm.tsx](../../src/hooks/useConfirm.tsx) 주석 참고).

### 1-2. 해결: 환경별로 알아서 내려가는 공유 유틸 하나로 통일

세 곳이 각자 카카오 SDK 를 부르는 걸 **`shareClubInvite()` 하나로 모으고**, 아래 순서로 폴백한다.
이러면 네이티브가 아무것도 안 해줘도 최소 클립보드까지는 반드시 도달한다.

```ts
// src/utils/shareInvite.ts (신설)

type ShareResult = 'native' | 'websha' | 'kakao' | 'clipboard';

export async function shareClubInvite(club: {
  name: string; invite_code: string; logo_url?: string | null;
}): Promise<ShareResult> {
  const url  = `${window.location.origin}/i/${club.invite_code}`;
  const text = `${club.name} 클럽에 초대합니다!\n함께 운동하며 건강한 습관을 만들어봐요 💪`;

  // 1순위 — 네이티브 공유 시트 (앱 안일 때. OS 공유창이라 카톡·문자·복사 전부 됨)
  if (window.CardioNative?.share) {
    window.CardioNative.share({ url, text, title: `${club.name} 클럽 초대` });
    return 'native';
  }

  // 2순위 — Web Share API (iOS WKWebView·모바일 Safari 에서 동작. Android WebView 는 미지원)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${club.name} 클럽 초대`, text, url });
      return 'websha';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'websha';   // 사용자가 닫은 건 실패가 아니다
      console.warn('[초대공유] Web Share 실패, 다음 수단으로:', err?.name, err?.message);
    }
  }

  // 3순위 — 카카오 JS SDK (일반 모바일/데스크톱 브라우저)
  if (window.Kakao?.isInitialized()) {
    try {
      window.Kakao.Share.sendDefault(buildKakaoPayload(club, url));
      return 'kakao';
    } catch (err: any) {
      console.error('[초대공유] 카카오 공유 실패:', JSON.stringify(err), err);
    }
  }

  // 4순위 — 클립보드 (무조건 성공하는 바닥)
  await copyToClipboard(`${text}\n${url}`);
  return 'clipboard';
}
```

- 반환값을 쓰는 이유: 호출부가 `'clipboard'` 일 때만 "복사했습니다" 토스트를 띄우면 된다.
  나머지는 OS/카톡이 자기 UI 를 띄우므로 우리가 아무 말도 하면 안 된다.
- `window.CardioNative.share` 는 **아직 없는 계약**이다 — §4 에서 and/app 에 요청.
  없으면 그냥 2순위로 내려가므로 **web 은 지금 배포해도 안전하다.**

### 1-3. 카카오 페이로드 (버튼 2개로 확장)

`feed` 템플릿은 버튼 2개까지 지원하는데 지금은 1개만 쓴다.

```ts
function buildKakaoPayload(club, url) {
  const payload: any = {
    objectType: 'feed',
    content: {
      title: `🏃 ${club.name} 클럽 초대`,
      description: `${club.name} 클럽에 초대합니다!\n앱을 설치하면 운동 기록이 자동으로 연동돼요 💪`,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [
      { title: '클럽 가입하기', link: { mobileWebUrl: url,               webUrl: url } },
      { title: '앱 설치하기',   link: { mobileWebUrl: `${url}?to=install`, webUrl: `${url}?to=install` } },
    ],
  };
  if (club.logo_url) payload.content.imageUrl = club.logo_url;
  return payload;
}
```

---

## 2. B. 받는 쪽 — 초대 게이트웨이 `/i/:code`

카카오 링크를 누르면 **웹 게이트웨이가 열리고, 환경을 판별해 각 경로로 인계**한다.
`/join/:code`(실제 가입 처리)는 그대로 두고 건드리지 않는다.

```
카카오 메시지 → https://cardio.scnd.kr/i/{code}
                        │
                        ├─ 앱 웹뷰?      → 즉시 /join/{code}  (게이트웨이 안 보여줌)
                        ├─ 카톡 인앱?    → 외부 브라우저 안내 (로그인이 막히므로)
                        ├─ iOS?          → App Store  /  웹으로 계속
                        ├─ Android?      → 웹으로 계속  /  앱 설치 신청(/download)
                        └─ 데스크톱?     → 웹으로 계속
```

### 2-1. 인계 규칙 (결정 완료)

| 환경 | 판별 | 처리 |
|---|---|---|
| **Cardio 앱 웹뷰** | `window.CardioNative` \|\| UA `cardio-android` | **`/join/{code}` 로 즉시 리다이렉트.** 이미 앱 안이라 설치 안내가 무의미 |
| **카카오톡 인앱** | UA `/KAKAOTALK/i` | ⚠️ 경고 배너 + 탈출. **Android**: `kakaotalk://web/openExternal` 버튼 / **iOS**: "우측 상단 ⋮ → 다른 브라우저로 열기" 문구 |
| **iOS 웹** | iOS UA, 인앱 아님 | 1순위 **App Store** (`apps.apple.com/kr/app/cardioxclub/id6779019606`) · 2순위 웹으로 계속 |
| **Android 웹** | Android UA, 인앱 아님 | 1순위 **웹으로 계속** · 2순위 `/download` (아래 §2-2) |
| **데스크톱** | 그 외 | **웹으로 계속** 단독 |

**Android 만 웹이 1순위인 이유** — prod `app_releases` 실측 결과 Android 는 공개 스토어 링크가
없다. 직접 APK(`.../storage/v1/object/public/apk/cardio-latest.apk`)이고,
[Download.tsx](../../src/pages/Download.tsx) 안내는 "이메일 남기면 검토 후 비공개 테스트 명단에
수동 추가" 절차다. 며칠 걸리는 사람 개입이라 초대 흐름의 1순위 CTA 로 두면 거기서 끊긴다.
(iOS 는 정상 App Store 링크가 있어 1순위로 둘 수 있다.)

### 2-2. Android CTA 문구 (결정)

초대받은 외부인에게 "비공개 테스트 중" 을 그대로 노출하지 않는다. 순화한다:

> **Android 앱은 준비 중이에요.** 지금은 웹으로 바로 이용할 수 있습니다.
> [웹으로 클럽 가입하기] ← 1순위
> 앱 출시 알림 받기 → `/download`

### 2-3. 화면 구성

```
┌────────────────────────────────┐
│  [클럽 로고]                    │
│  {클럽명} 에 초대받았습니다       │  ← 비로그인도 보임 (§3-1)
│  클럽장 {닉네임}                 │
│  {클럽 소개}                     │
├────────────────────────────────┤
│  (카톡 인앱일 때만) ⚠ 배너 + 탈출  │
├────────────────────────────────┤
│  초대코드   A B 3 X Y 9   [복사]  │  ← 항상. 모든 폴백의 바닥 (§3-2)
├────────────────────────────────┤
│  [ 1순위 CTA — 환경별 ]           │
│  [ 2순위 CTA ]                   │
├────────────────────────────────┤
│  ▸ 앱에서 가입하는 방법            │  ← ?to=install 이면 펼친 채로 진입
│    1. 앱 설치                     │
│    2. 카카오로 로그인              │
│    3. 클럽 탭 → + → 초대코드 입력  │
│    4. 코드 A B 3 X Y 9 입력       │
└────────────────────────────────┘
```

"앱에서 가입하는 방법"이 요청하신 **앱 내 가입 절차 안내**다. 스토어 갔다 온 뒤 뭘 눌러야 하는지를
미리 읽히는 게 목적이라, 접어두되 설치 CTA 를 누르면 자동으로 펼친다.

### 2-4. 판별 유틸 (기존 코드 승격)

[Login.tsx:10 `detectInApp()`](../../src/pages/Login.tsx) 가 이미 있는데 그 파일 지역 함수다.
`src/utils/browserEnv.ts` 로 승격해 게이트웨이와 공유한다.

```ts
export type Platform = 'ios' | 'android' | 'desktop';
export type InAppKind = 'kakaotalk' | 'naver' | 'facebook' | 'instagram' | 'line' | null;

export const detectInApp = (): InAppKind => { /* Login.tsx 것 그대로 이동 */ };
export const getPlatform = (): Platform => {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
};
export const isNativeApp = (): boolean =>
  !!window.CardioNative || /cardio-android/.test(navigator.userAgent);
```

Login.tsx 는 이 유틸을 import 하도록 바꾼다 (중복 정의 제거).

---

## 3. 같이 고쳐야 하는 것 2가지

### 3-1. 🔴 비로그인 사용자가 클럽 이름조차 못 본다 (제일 크게 새는 구멍)

[JoinClub.tsx:26-33](../../src/pages/JoinClub.tsx) 이 비로그인이면 **즉시 `/`(로그인)으로
리다이렉트**한다. 초대받는 사람은 대부분 비로그인 신규인데, 첫 화면이 "무슨 클럽인지도 모를 로그인 창"이다.

```tsx
if (!authLoading && !user) {
  sessionStorage.setItem('redirect_after_login', currentPath);
  navigate('/');                    // ← 맥락이 통째로 날아감
}
```

**변경**: 비로그인 → `/i/:code`(게이트웨이)로 리다이렉트. 게이트웨이가 클럽을 보여주고 로그인을 유도한다.
이러면 예전에 뿌려진 `/join/:code` 링크도 새 경험으로 수렴한다.

> DB 작업 불필요 — RLS 정비 후에도 `clubs_select` / `club_members_select` 정책이 `anon` 에게
> 열려 있어 **비로그인 클럽 미리보기가 그대로 된다.** 기존 `getClubPreviewByInviteCode` 재사용.

### 3-2. 초대코드는 항상 눈에 보이게 (스토어 경유 시 맥락이 끊기므로)

Safari → App Store → 설치 → 앱 첫 실행 시, 앱 웹뷰는 **Safari 와 저장소를 공유하지 않는다**
(WKWebView 독립 저장소). `localStorage` 로 초대코드를 넘기는 건 작동하지 않는다.

전달 수단은 셋뿐이고, **세 번째가 지금 유일하게 되는 것**이다:

| 방법 | 상태 |
|---|---|
| Universal Links | ❌ `public/.well-known/` 자체가 없음 → 링크가 앱으로 안 열림 (Phase 3) |
| 카카오 ExecutionParams | ⏳ Phase 2 (§5) |
| **6자리 코드 수동 입력** | ✅ **지금 됨** — `/join` 이 코드 입력 폼을 이미 지원 (JoinClub.tsx:182-220) |

그래서 게이트웨이에서 코드를 크게 + 복사 가능하게 노출한다.

---

## 4. and / app 에 요청할 것

### 4-1. 지금 필요 (Phase 1 과 병행) — 공유 브릿지

앱 안에서 공유가 되게 하려면 브릿지에 `share` 하나만 추가하면 된다.
[native-bridge.d.ts](../../src/types/native-bridge.d.ts) 계약 확장:

```ts
interface CardioNativeBridge {
  logout?: () => void;
  openHealthSync?: () => void;
  onThemeChange?: (theme: 'light' | 'dark') => void;
  /** 초대 링크 공유 — OS 공유 시트를 띄운다. (iOS: UIActivityViewController / Android: ACTION_SEND) */
  share?: (payload: { url: string; text: string; title?: string }) => void;   // ← 신설
}
```

- 없으면 web 이 알아서 폴백하므로 **급하지 않고, 순서 의존도 없다.**
- 대안으로 `kakaolink://`(iOS) / `intent://`(Android) 스킴 통과를 허용해도 되지만,
  **OS 공유 시트가 카톡·문자·복사를 다 커버해서 더 낫다.**

### 4-2. Phase 2 (§5 결정 후)

카카오 ExecutionParams 수신 → 웹뷰를 `/join/{code}` 로 진입.

---

## 5. Phase 2 — 링크를 누르면 앱이 열리게 (나중)

Phase 1 배포 후 전환율 보고 착수 결정한다. **Universal Links 말고 카카오 자체 앱 연결을 쓴다** —
공유가 어차피 카카오 안에서 일어나므로 설정 비용이 훨씬 싸다.

```ts
link: {
  mobileWebUrl: `${origin}/i/${code}`,
  webUrl:       `${origin}/i/${code}`,
  androidExecutionParams: `invite=${code}`,   // 설치돼 있으면 앱 실행
  iosExecutionParams:     `invite=${code}`,   // 없으면 mobileWebUrl 로 폴백
}
```

필요한 것: 카카오 developers 콘솔에 Android 패키지명 + 키해시 / iOS 번들 ID 등록,
그리고 §4-2. 미설치자는 그대로 게이트웨이로 떨어지므로 **Phase 1 이 계속 폴백으로 작동**한다.

(카카오 밖 — 문자·인스타·복사된 링크 — 에서도 앱 직행이 필요해지면 그때 Universal Links.
그땐 `vercel.json` 의 `rewrites: /((?!api/).*)` 가 `.well-known` 까지 index.html 로 보내버리므로
**예외 처리 필수**. 안 하면 검증 파일이 HTML 을 뱉어 실패한다.)

---

## 6. 작업 목록 (Phase 1 — web 단독으로 완결)

| # | 작업 | 파일 |
|---|---|---|
| 1 | 환경 판별 유틸 승격 (`detectInApp`/`getPlatform`/`isNativeApp`) | `src/utils/browserEnv.ts` **신설** · Login.tsx 는 import 로 교체 |
| 2 | 공유 4단 폴백 유틸 | `src/utils/shareInvite.ts` **신설** |
| 3 | 공유 호출부 3곳을 유틸로 교체 | Club.tsx:528 · WorkoutFeedCard.tsx:105 · AddWorkout.tsx:795 |
| 4 | 카카오 페이로드 버튼 2개로 확장 | shareInvite.ts |
| 5 | 초대 게이트웨이 신설 | `src/pages/InviteLanding.tsx` **신설** + App.tsx 라우트 `/i/:code` |
| 6 | 앱 웹뷰면 `/join/:code` 로 즉시 인계 | InviteLanding |
| 7 | 카톡 인앱 경고 + 탈출(Android)/수동안내(iOS) | InviteLanding |
| 8 | 초대코드 크게 + 복사 | InviteLanding |
| 9 | "앱에서 가입하는 방법" 4단계 (`?to=install` 이면 펼침) | InviteLanding |
| 10 | 플랫폼별 CTA — iOS=App Store / Android=웹 우선 + `/download` | InviteLanding (`app_releases` 조회 재사용) |
| 11 | `/join/:code` 비로그인 → `/i/:code` 리다이렉트 | JoinClub.tsx:26-33 |
| 12 | 브릿지 타입에 `share` 추가 (선택적이라 즉시 안전) | native-bridge.d.ts |

### 지킬 것

- 게이트웨이는 **비로그인 외부인이 보는 첫 화면**이다 → `/download` 처럼 **앱 셸 밖 독립 랜딩**으로 둔다
  (BottomNav/Header 없음).
- **색상은 반드시 테마 토큰.** 첫인상 화면이라 다크모드에서 깨지면 그대로 이탈이다
  ([design-guide_color-system.md](../design-guide_color-system.md)).
- 확인창이 필요하면 `confirm()` 금지, `useConfirm()` 사용.
- `vh/dvh` 금지 — 앱 웹뷰에서 0 으로 계산됨 ([CLAUDE.md](../../CLAUDE.md)).

---

## 부록. 실측으로 확인한 제약

| # | 사실 | 근거 |
|---|---|---|
| 1 | Universal Links/App Links 미설정 → 링크가 앱으로 안 열림 | `public/.well-known/` 디렉터리 없음 |
| 2 | 카톡 인앱에서 카카오 로그인 차단됨 (iOS 는 자동 탈출도 불가) | 2026-06-18 사용자 보고. Login.tsx:81 배너, Support.tsx:61 |
| 3 | Android 공개 스토어 링크 없음 (비공개 테스트) | prod `app_releases` 실측 + Download.tsx:143-147 |
| 4 | iOS 는 정상 App Store 링크 있음 | `apps.apple.com/kr/app/cardioxclub/id6779019606` |
| 5 | 비로그인 클럽 미리보기 가능 (RLS 열려 있음) | `clubs_select` / `club_members_select` 정책 `TO anon` |
| 6 | 스토어 경유 시 localStorage 로 코드 전달 불가 | WKWebView 독립 저장소 |
