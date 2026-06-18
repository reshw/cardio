# Cardio 웹앱 개발 가이드

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

### dvh / svh / lvh 단위 사용 시 vh fallback 필수

구형 Android WebView(Chrome 108 미만)에서 `dvh` 미지원 시 height가 0으로 collapse됨.
반드시 `vh` fallback 라인을 앞에 추가할 것.

```css
/* 금지 */
max-height: 90dvh;

/* 올바름 */
max-height: 90vh;
max-height: 90dvh;
```

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

## Git / 배포 규칙

- push 전 반드시 `npm run build` 통과 확인
- 작업은 dev 브랜치에서 하고, push 요청 시 dev → master 머지 후 master push
- Vercel 자동 배포가 가끔 웹훅 누락됨 → 미배포 확인 시 `vercel --prod` 수동 배포

## 네이티브 앱 연동

- Android WebView User-Agent에 `cardio-android` 포함됨
- `useIsNativeApp()` 훅으로 감지 (`src/hooks/useIsNativeApp.ts`)
- 네이티브 앱 환경에서는 BottomNav 숨김 (Header는 표시)
- 세션 주입: `/app-auth?token=ACCESS_TOKEN&refresh=REFRESH_TOKEN&redirect=/` (`src/pages/AppAuthBridge.tsx`)
