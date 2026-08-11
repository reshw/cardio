# Samsung Internet / KakaoTalk 파일업로드 이슈 수정 계획

작성일: 2026-06-09  
대상 파일: `src/pages/AddWorkout.tsx`, `src/App.css`

---

## 1. 현상 정리 (확정된 사실)

디버그 패널 로그에서 확인된 것:
```
MOUNT step=3 draft_img=NO    ← 첫 진입
PICKER open (btn)             ← 📷 추가 버튼 클릭
[갤러리 앱 전환]
MOUNT step=3 draft_img=NO    ← 두 번째 MOUNT! onChange 없음
```

**확정**: `onChange`가 발화하기 전에 React 컴포넌트 자체가 다시 마운트됨.  
→ bfcache 복원이라면 re-mount가 일어나지 않는다. 따라서 이것은 **cold start (재시작)**.

**미확정**: 재시작의 원인이 무엇인가?
- A) Android가 백그라운드 WebView 프로세스를 kill (메모리 압박 또는 정책)
- B) Android Activity 스택: 갤러리 Activity 실행 시 Browser Activity가 `onDestroy` → OS가 앱 재시작
- C) popstate 이벤트: 갤러리 앱 전환 시 Android가 history.back()을 push → BrowserRouter가 navigation으로 처리

A·B는 동일한 증상 (페이지 kill). C는 다른 매커니즘.

---

## 2. 각 조치별 분석

### ✅ 조치 1: `pagehide` 이벤트 디버그 로그 추가

**목적**: kill(A·B)인지 popstate(C)인지 구분

- `pagehide { persisted: false }` → 진짜 kill. HashRouter 교체 해도 안 됨
- `pagehide { persisted: true }` → bfcache. onChange 재시도 로직 유효
- pagehide가 아예 안 찍힌다면 → popstate로 인한 React 내부 navigation이 원인 (C)

**코드 위치**: `AddWorkout.tsx` 44번째 줄 근처 useEffect (visibilitychange 등록하는 곳)  
**위험도**: 없음. 디버그 이벤트 추가만.

---

### ✅ 조치 2: CSS `display:none` → `opacity:0` 변경

**목적**: Samsung Internet의 `display:none` input onChange 미발화 버그 대응 (Q7)

현재:
```css
.file-input-hidden { display: none; }
```
변경:
```css
.file-input-hidden {
  opacity: 0;
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
```

**주의**: todo 문서에서 "9a49807에서 동일한 display:none으로 작동했다면 이건 아닐 가능성 높음"이라고 언급됨.  
→ cold start kill 시나리오에서는 onChange 자체가 발화 안 하므로 이 CSS 변경으로는 kill 문제를 해결 못 함.  
→ 다만 kill이 아닌 별도의 "onChange 미발화" 버그가 혼재할 경우 효과 있음.  
→ 변경해도 기존 동작에 영향 없음.

**위험도**: 매우 낮음. UI 변화 없고 기능 변화 없음.

---

### ✅ 조치 3: `capture="environment"` 카메라 전용 버튼 추가

**목적**: 갤러리 앱 전환 없이 카메라에서 직접 촬영 → 외부 앱 전환 자체가 없으므로 kill 안 됨

**구현 방식**:
- 기존 "📷 추가" 버튼 (갤러리 선택, 현재 방식) 유지
- 새로 "📸 촬영" 버튼 추가 (`capture="environment"` input 별도 ref)

**주의사항**:
- `capture="environment"` 속성이 있으면 **갤러리 선택 불가**, 카메라만 열림
- Samsung Internet이 capture를 지원하면 브라우저 내에서 카메라 → kill 없음
- Samsung Internet이 capture를 무시하면 외부 카메라 앱을 열어 동일하게 kill 발생할 수 있음
- 실제로 효과 있는지는 기기에서 테스트 필요

**위험도**: 낮음. 버튼 하나 추가되는 것이며 기존 갤러리 버튼은 유지.

---

### ✅ 조치 4: Samsung Internet / KakaoTalk UA 감지 → Chrome 안내 배너

**목적**: 문제가 생기는 환경에서 사용자가 직접 Chrome으로 전환할 수 있도록 안내

**UA 패턴**:
- Samsung Internet: `navigator.userAgent.includes('SamsungBrowser')`
- KakaoTalk 인앱: `navigator.userAgent.includes('KAKAOTALK')`

**구현**: step 3 상단에 비침투적 안내 배너 (1회 dismiss 가능, localStorage로 기억)

**위험도**: 없음. 정보 표시만.

---

### ⚠️ 조치 5 (미시행): HashRouter 교체

**목적**: Android의 popstate 이벤트가 BrowserRouter를 navigation으로 처리하는 문제 차단 (Q2)

**위험 분석**:
- 현재 `App.tsx`에 `/auth/callback`, `/auth/kakao/callback` 라우트가 존재
- Supabase OAuth 리다이렉트 URL이 `https://도메인.com/auth/callback`으로 등록되어 있을 것
- HashRouter로 교체 시 해당 라우트는 `https://도메인.com/#/auth/callback`이어야 매칭됨
- Supabase 대시보드에서 Redirect URL도 `/#/auth/callback`으로 변경해야 함
- KakaoTalk 앱에 등록된 리다이렉트 URI도 변경 필요
- **변경 실패 시 카카오 로그인 전면 불가**

**결론**: 조치 1(pagehide 로그)로 원인 확정 후 판단.
- kill 원인(A·B)이 확정되면 HashRouter 교체는 의미 없음
- popstate 원인(C)가 확정되면 HashRouter 교체 시도 (Supabase/Kakao 설정 동시 변경 필요)

---

## 3. 구현 범위 (이번 작업)

| # | 변경 내용 | 파일 | 위험도 |
|---|-----------|------|--------|
| 1 | pagehide 디버그 로그 추가 | AddWorkout.tsx | 없음 |
| 2 | .file-input-hidden CSS 변경 | App.css | 매우 낮음 |
| 3 | capture 카메라 버튼 추가 | AddWorkout.tsx | 낮음 |
| 4 | UA 감지 Chrome 안내 배너 | AddWorkout.tsx | 없음 |

HashRouter 교체(5번)는 **pagehide 로그로 원인 확정 후** 별도 진행.

---

## 4. 테스트 방법

1. Galaxy 기기 + Samsung Internet에서 `/add-workout?debug=1` 접속
2. 운동 추가 step 3 진입
3. "📷 추가" 버튼 클릭 → 갤러리 선택
4. 디버그 패널에서 확인:
   - `pagehide persisted=false` → 확정 kill → HashRouter 불필요
   - `pagehide persisted=true` → bfcache → 다른 접근 필요
   - pagehide 로그 없음 → popstate 원인 → HashRouter 시도 가치 있음
5. "📸 촬영" 버튼도 테스트 (capture 동작 여부)
