# 네이티브 브릿지 통합 — 바텀네비 중복 제거 + 테마 동기화

web / and(Android) / app(iOS) 세 프로젝트가 **하나의 계약**을 공유하도록 정리한다.
발단: iOS 앱에서 (1) 웹 바텀네비가 네이티브 탭바와 중복 표시, (2) 더보기에서 다크로 바꿔도
다른 탭 웹뷰·앱 크롬(상태바/노치/탭바)은 흰색으로 남는 문제.

---

## 계약 (플랫폼 공통)

### 1. 네이티브 감지 — 기준은 `window.CardioNative` 하나

| | 지금 | 바꾼 뒤 |
|---|---|---|
| 판별 | `navigator.userAgent.includes('cardio-android')` | `!!window.CardioNative` (UA 는 구버전 하위호환 fallback) |

- **네이티브 책임**: 첫 스크립트 실행 전에 `window.CardioNative` 주입
  - iOS: `WKUserScript(injectionTime: .atDocumentStart)`
  - Android: `addJavascriptInterface` (페이지 로드 전 등록)
- 늦게 주입되면 첫 렌더에서 바텀네비가 한 번 번쩍이고 사라진다. `documentStart` 주입 필수.
- UA fallback 은 브릿지를 안 주입하는 **기존 배포된 Android 앱**을 위해 남긴다.
  and 쪽 브릿지 주입이 전 버전에 깔리면 그때 제거.

### 2. 테마 아웃바운드 — `window.CardioNative.onThemeChange(theme)`

```ts
window.CardioNative?.onThemeChange?.('dark' | 'light')
```

- **호출 시점**: 웹뷰 부팅 직후 1회 + 사용자가 토글할 때마다 1회
- **네이티브 책임**
  1. 앱 크롬(상태바·노치 배경·네이티브 탭바)에 반영
  2. 값을 저장 → 다음 실행 시 웹 로드 전에 선반영 (깜빡임 제거)
  3. 같은 세션에 살아있는 **다른 탭 웹뷰**에 3번(인바운드)으로 전파

`<meta name="theme-color">` 갱신은 그대로 두되, WKWebView/WebView 안에선 효과가 없으므로
앱 크롬 색은 전적으로 이 브릿지에 의존한다.

### 3. 테마 인바운드 — `window.CardioWeb.setTheme(theme)`

네이티브 → 웹 방향. **이게 없으면 iOS 의 탭별 독립 웹뷰는 앱 재실행 전까지 옛 테마로 남는다**
(원 보고의 핵심 지적). 웹이 전역에 노출한다.

```ts
window.CardioWeb.setTheme('dark')   // 네이티브가 다른 웹뷰들에 대고 호출
```

- 웹은 `data-theme` + `localStorage` + React 상태를 함께 갱신
- **에코 방지**: 들어온 값이 현재 값과 같으면 no-op → `onThemeChange` 재발신이 되돌아오지 않음
- 부팅 시점엔 인바운드 push 불필요 — `localStorage` 가 이미 소스이고 `index.html` 선적용
  스크립트가 처리한다. 인바운드는 "살아있는 웹뷰 전파" 전용.

---

## 웹 구현 변경 (이 저장소)

### `src/types/native-bridge.d.ts`
- `CardioNativeBridge` 에 `onThemeChange?: (theme: 'light' | 'dark') => void` 추가
- `window.CardioWeb` (인바운드 API) 타입 선언 추가

### `src/hooks/useIsNativeApp.ts`
- `!!window.CardioNative || navigator.userAgent.includes('cardio-android')`
- SSR/비브라우저 가드는 불필요 (이 앱은 CSR 전용)

### `src/hooks/useTheme.ts` — 모듈 레벨 스토어로 전환
지금은 **`More.tsx` 한 곳에서만 마운트**된다. 그래서 `/more` 밖에서는 테마 로직이 아예
돌지 않고, 부팅 알림도 더보기 탭에서만 나간다. 브릿지를 붙이려면 이 구조를 먼저 고쳐야 한다.

- 모듈 레벨 `currentTheme` + 리스너 Set, `useSyncExternalStore` 로 구독
- `applyTheme()` 안에서 `onThemeChange` 발신
- `window.CardioWeb.setTheme` 은 **모듈 로드 시점에 등록** — 네이티브가 React 마운트를
  기다리지 않고 바로 밀어넣을 수 있게
- 마운트 시 `onThemeChange` 를 한 번 더 발신 (네이티브가 documentStart 주입을 지키지
  않아 모듈 평가 시점 통지가 유실된 경우의 안전망)

### `src/App.tsx`
- `App`/`ProtectedRoutes` 에서 `useTheme()` 1회 호출 → 어느 페이지로 진입해도
  부팅 알림과 인바운드 등록이 보장됨

바텀네비 렌더 지점(`{!isNativeApp && <BottomNav />}`)은 **이미 게이팅되어 있어 수정 불필요**.
`useIsNativeApp` 만 고치면 iOS 도 자동으로 숨겨진다.

---

## 상대 에이전트에 전달할 것

- **app(iOS)**: `CardioNative` 를 `atDocumentStart` 주입 / `onThemeChange` 수신 → 크롬 반영·저장·
  타 웹뷰에 `CardioWeb.setTheme` 전파
- **and(Android)**: 동일 계약. `onThemeChange` 만 추가하면 됨 (브릿지·UA 는 이미 있음)

---

## 검증

- [ ] `npm run build` 통과
- [ ] 브라우저(브릿지 없음): 바텀네비 정상 표시, 테마 토글 정상
- [ ] `window.CardioNative = {}` 주입 후: 바텀네비 사라짐
- [ ] `window.CardioWeb.setTheme('dark')` 콘솔 호출 → 즉시 다크 전환, 토글 UI 도 따라옴
- [ ] 같은 값 재호출 시 `onThemeChange` 재발신 없음 (에코 방지)
