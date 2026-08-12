# Cardio 웹앱 개발 가이드

## 협업 인박스 — 당신은 `web` 에이전트

세 프로젝트(cardio / cardio-and / cardio-app)가 `D:\dev\cardio-comms\` 공유 폴더로 메시지를 주고받습니다. 당신의 인박스는 `D:\dev\cardio-comms\to-web\` 입니다. 상세 규칙은 아래 import 참조.

@D:\dev\cardio-comms\protocol.md

## 프로젝트 개요
Android 앱이 WebView로 이 React 웹앱을 표시하는 구조.
- 프로덕션 도메인: `https://cardio.scnd.kr`
- Vercel 자동 배포 (master 브랜치 push 시 트리거)
- Supabase 백엔드

---

## Android WebView CSS 호환성 규칙

### 절대 금지

**`html`, `body`에 `overflow: hidden` 또는 `overflow-x: hidden` 사용 금지**
- Android WebView 버그: `html`/`body`에 `overflow: hidden`/`overflow-x: hidden`이 있으면 `position: fixed` 요소가 viewport 기준이 아닌 document 기준으로 위치가 잡힘
- 결과: 모달/바텀시트 오버레이가 전체 화면을 덮지 않고 콘텐츠 높이만큼만 렌더됨, 모달 내용이 화면 밖으로 밀려 안 보임
- **대신 `overflow-x: clip` 사용** — clip은 스크롤을 막지만 containing block을 바꾸지 않음

```css
/* 금지 */
html { overflow-x: hidden; }
body { overflow-x: hidden; }

/* 올바름 */
html { overflow-x: clip; }
body { overflow-x: clip; }
```

---

### viewport 단위 (vh / dvh / svh / lvh) 사용 금지

`cardio-android` WebView 에서 **vh / dvh 둘 다 0 으로 계산되는 버그** 확인됨 (Chrome WebView 149 에서도 발생). 결과: `max-height: 90vh` → 0 → 모달/시트 콘텐츠 0 px 컬랩스 → 검정 backdrop만 보이고 내용 사라짐.

Chrome 브라우저에선 정상이라 prod 일반 사용자는 모르지만, cardio-and WebView 안에선 모달 전체가 깨짐.

```css
/* 금지 — vh, dvh, svh, lvh 전부 */
max-height: 90vh;
max-height: 90dvh;
height: 100dvh;
min-height: calc(100vh - 60px);
```

**대안 패턴**

1. **`%` (부모가 viewport 사이즈일 때)** — 모달/시트의 경우 부모 `position: fixed; inset: 0` 오버레이가 viewport 풀사이즈이므로 자식의 `%` 가 vh 등가:

   ```css
   .modal-overlay { position: fixed; inset: 0; }
   .modal-content { max-height: 90%; }   /* vh 대신 */
   ```

2. **고정 px** — 모달 내부 inner element 또는 자체 `position: fixed` 박스처럼 부모가 viewport 사이즈가 아닌 경우:

   ```css
   .notification-dropdown { position: fixed; max-height: 600px; }
   .modal-inner-list      { max-height: 400px; }
   ```

3. **JS 계산 inline style** — 동적 계산 필요한 경우 `window.innerHeight * 0.7` 등.

페이지 풀사이즈 컨테이너(`min-height: 100vh` 패턴)는 cosmetic 영향만 있어 일단 보류 중. 정식 마이그레이션 시 html/body/#root 에 `height: 100%` 추가 후 `100%` 로 전환 필요.

---

### position: fixed 오버레이는 inset: 0 만 사용, height 중복 지정 금지

`position: fixed; inset: 0`과 동시에 `height: 100dvh` 같은 명시적 height를 주면
over-constrained가 되어 Android WebView에서 예상치 못한 stacking/sizing 발생.

```css
/* 금지 */
.overlay {
  position: fixed;
  inset: 0;
  height: 100dvh; /* 충돌 */
}

/* 올바름 */
.overlay {
  position: fixed;
  inset: 0;
}
```

---

### 모달/바텀시트는 반드시 createPortal 사용

React 컴포넌트 트리 안에서 `position: fixed` 모달을 렌더하면
부모 컴포넌트의 stacking context(transform, will-change, overflow 등)에 갇혀
Android WebView에서 z-index가 의도대로 동작하지 않음.

모든 모달, 바텀시트, 오버레이는 `document.body` 직하위에 렌더할 것.

```tsx
import { createPortal } from 'react-dom';

// 금지
return (
  <div className="modal-overlay">...</div>
);

// 올바름
return createPortal(
  <div className="modal-overlay">...</div>,
  document.body
);
```

새 바텀시트/모달을 만들 때는 헤더를 새로 디자인하지 말 것 — 기존 패턴(가운데정렬 타이틀 / 왼쪽정렬 h3
타이틀 / 타이틀+서브타이틀 3가지), 상단 고정(핸들·헤더), 닫기 버튼 크기가 전부 정리돼 있다:
**@docs/design-guide_bottom-sheet.md**

특히 **시트의 `gap`/`padding` 을 직접 바꾸면 sticky 헤더 고정이 깨진다** — `--sheet-gap` /
`--sheet-pad-top` 변수를 덮어쓸 것. 이유와 검증법은 위 문서 4절에 있다.

---

### flex child overflow 스크롤 시 min-height: 0 필수

flex container 안에서 `flex: 1; overflow-y: auto`를 쓰는 자식은
`min-height: 0`이 없으면 content 높이로 overflow되어 스크롤이 안 됨.

```css
/* 금지 */
.scrollable-body {
  flex: 1;
  overflow-y: auto;
}

/* 올바름 */
.scrollable-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

---

### backdrop-filter 사용 시 solid fallback 필수

일부 Android WebView에서 `backdrop-filter` 미지원.
반드시 불투명에 가까운 background-color를 먼저 선언할 것 (지원 시 blur 효과 추가됨).

```css
/* 올바름 */
.header {
  background: rgba(255, 255, 255, 0.98); /* fallback: 불투명 배경 */
  backdrop-filter: blur(10px);           /* 지원 시 blur */
}
```

---

## 색상은 하드코딩 금지 — 테마 토큰 사용

라이트/다크 테마가 `[data-theme]` + CSS 변수로 동작한다. 표면·글자·테두리 같은 **구조색을
하드코딩하면 다크모드가 깨진다.** 특히 **강조색 배경 위 글자는 `var(--on-accent)`** 를 써야 한다
(다크에서 primary 가 밝은 시안이라 흰 글자는 대비 1.68:1 로 판독 불가).

```css
/* 금지 */
.btn { background: var(--primary-color); color: #fff; }
.card:hover { background: #f8f8f8; }

/* 올바름 */
.btn { background: var(--primary-color); color: var(--on-accent); }
.card:hover { background: var(--card-hover-bg); }
```

tsx 인라인 스타일에서도 동일하게 토큰을 쓸 것 (인라인이 CSS 를 이기므로 CSS 만 고치면 안 바뀜).
단, 상태색(에러/성공)·외부 브랜드색(카카오/Strava)은 두 테마 공통이라 그대로 둔다.

토큰 카탈로그 · 함정 5가지 · 조사/검증 스크립트: **@docs/design-guide_color-system.md**

---

## 에러 처리 규칙 (필수)

**"오류가 발생했습니다", "생성에 실패했습니다" 같은 원인 없는 메시지 절대 금지.**
사용자에게 보이는 에러와 console 로그 모두 **실제 원인(에러 message/code/detail)을 반드시 포함**할 것.
디버깅 왕복(사용자 재현 → 로그 요청)을 없애는 게 목적이다.

```ts
// 금지 — 원인이 사라짐
} catch {
  setError('생성에 실패했습니다.');
}

// 올바름 — 실제 supabase/JS 에러를 그대로 노출
} catch (err: any) {
  console.error('[기능명] 생성 실패 상세:', JSON.stringify(err), err);
  const msg = err?.message || err?.error_description || err?.hint || JSON.stringify(err);
  setError(`생성 실패: ${msg}`);
}
```

- catch 블록은 `catch {}`(에러 바인딩 생략) 대신 `catch (err)`로 에러를 반드시 잡아 로그
- supabase 에러는 `message`뿐 아니라 `code`/`details`/`hint`도 유용 → `JSON.stringify(error)`로 통째로 남길 것
- 서비스 계층에서 `throw` 하기 전 `console.error`로 원인 로그, 다단계 작업은 단계별 성공/실패 로그
- 사용자 노출 문구엔 최소한 에러 message를 붙여, 스크린샷만으로 원인 파악 가능하게

## Git / 배포 규칙

- push 전 반드시 `npm run build` 통과 확인
- 작업은 dev 브랜치에서 하고, push 요청 시 dev → master 머지 후 master push
- Vercel 자동 배포가 가끔 웹훅 누락됨 → 미배포 확인 시 `vercel --prod` 수동 배포
- **staging 테스트 배포는 `git push origin staging`으로만** (dev → staging merge 후) —
  `vercel` CLI ad-hoc 배포는 브랜치 전용 환경변수(R2/Supabase/Kakao 등)를 못 받아 업로드 등이
  500 남. 도메인·환경변수 스코프·리다이렉트 URL 등 상세는 **@docs/deploy.md**

## 네이티브 앱 연동

- Android WebView User-Agent에 `cardio-android` 포함됨
- `useIsNativeApp()` 훅으로 감지 (`src/hooks/useIsNativeApp.ts`)
- 네이티브 앱 환경에서는 BottomNav 숨김 (Header는 표시)
- 세션 주입: `/app-auth?token=ACCESS_TOKEN&refresh=REFRESH_TOKEN&redirect=/` (`src/pages/AppAuthBridge.tsx`)
