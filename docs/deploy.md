# 배포 환경 가이드

브랜치 3개(`dev` / `staging` / `master`)와 Vercel 배포 관계, 그리고 2026-08-12에 staging에서
연달아 겪은 문제(업로드 500, 카카오 로그인 무한로딩)의 진짜 원인이 전부 "배포 방식"이었던
경위를 기록해둔다. 다음에 staging에서 뭔가 원인불명으로 깨지면 여기부터 볼 것.

---

## 1. 브랜치 → 배포 대상

| 브랜치 | Vercel target | 트리거 | 용도 |
|---|---|---|---|
| `master` | Production | `master`에 push | 실서비스. `cardio.scnd.kr` |
| `staging` | Preview (staging 브랜치 전용 스코프) | `staging`에 push | 테스트 배포. 아래 3절 |
| `dev` | (배포 안 됨) | - | 평소 작업 브랜치 |

**작업은 항상 `dev`에서 하고, staging 테스트가 필요하면 `dev`를 `staging`에 merge 후
`git push origin staging`으로 배포한다.** master push(운영 배포)는 사용자가 명시적으로
요청할 때만.

---

## 2. staging 도메인 — 2개, 용도가 다름

| 도메인 | 정체 | 비고 |
|---|---|---|
| `crd.scnd.kr` | Vercel에 등록된 **커스텀 도메인**, staging 브랜치에 고정 연결 | **기본으로 이걸 씀.** staging에 push하면 자동 갱신 |
| `cardio-staging-test.vercel.app` | 수동으로 만든 **alias** | ad-hoc 확인용 보조. `vercel alias set <deployment-url> cardio-staging-test.vercel.app`로 수동 갱신해야 함 |

둘 다 Supabase Auth 리다이렉트 허용 목록에 등록돼 있어야 카카오 로그인이 된다 (5절 참고).

### Vercel Deployment Protection (SSO 게이트)

이 프로젝트는 Preview 배포에 Vercel 자체 로그인 보호가 걸려 있다. **팀 Vercel 계정에
로그인 안 된 브라우저(자동화 툴 포함)로 접속하면 vercel.com 로그인 화면으로 리다이렉트된다.**
실제 사용자는 이미 Vercel에 로그인돼 있어서 못 느낀다 — "브라우저 자동화로 확인해보니
안 열린다"는 이 게이트 때문일 뿐 배포 자체의 문제가 아닐 수 있다.

---

## 3. ⚠️ staging 배포는 반드시 `git push origin staging` — `vercel deploy` CLI 금지

**2026-08-12 사고**: `vercel` CLI로 ad-hoc preview를 만들어서 `cardio-staging-test.vercel.app`에
alias만 갈아끼우는 방식으로 여러 번 배포했다가, **업로드 API가 전부 500이 났다.**

원인: Vercel 프로젝트의 환경변수 중 상당수가 `Preview (staging)` — **"staging" 브랜치 전용
스코프**로 걸려 있다. `vercel env ls` 로 보면 이렇게 뜬다 (일부):

```
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME / R2_PUBLIC_URL
VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY
VITE_KAKAO_REST_API_KEY / VITE_KAKAO_JAVASCRIPT_KEY
VITE_CLOUDINARY_* / OPENAI_API_KEY / GEMINI_API_KEY / RESEND_API_KEY
                                    Preview (staging)     ← 브랜치 이름이 "staging"인 배포만
```

`vercel` CLI를 그냥 실행하면 로컬에서 현재 체크아웃된 브랜치(`dev` 등)로 배포가 태그되는데,
이건 `staging`이 아니므로 **위 환경변수를 하나도 못 받는다.** 그 결과 서버 함수 안에서
`process.env.R2_ACCOUNT_ID` 등이 전부 `undefined` → `createClient(undefined, ...)` 같은
코드가 그 자리에서 바로 죽는다. 실측 로그:

```
Error: supabaseUrl is required.
    at ... createClient (...) at /vercel/path0/api/upload-to-r2.ts:10:18
```

**결론 — staging 배포는 반드시:**

```bash
git checkout staging
git merge dev --no-edit
git push origin staging   # Vercel git 연동이 자동으로 올바른 스코프로 배포
```

`vercel` CLI ad-hoc 배포는 급하게 뭔가 하나만 확인할 때 외엔 쓰지 말 것. 쓰더라도
env var 관련 기능(업로드, DB 연결 등)은 절대 그걸로 검증하면 안 된다 — 통과해도 의미 없고
실패해도 코드 문제인지 배포 방식 문제인지 헷갈린다.

### 확인 방법 (배포가 올바른 브랜치로 태그됐는지)

```bash
vercel inspect <deployment-url>
```
출력의 `Aliases` 항목에 `cardio-git-staging-reshws-projects.vercel.app` 가 있으면 정상
(브랜치=staging 으로 인식됨). 없으면 env var 스코프를 못 받은 배포다.

---

## 4. Production 환경변수와는 이미 동일함 (2026-08-12 확인)

"그냥 production 변수 다 쓰면 안 되나" 싶어서 `vercel env pull`로 두 스코프를 다운받아
diff 떠봤는데, Vercel이 자동으로 넣는 메타데이터(`VERCEL_ENV` 등) 말고는 **모든 실제 값이
이미 Production과 100% 동일했다.** 별도 staging 전용 Supabase 프로젝트 같은 것도 없고,
지금 세션 내 모든 테스트(마이그레이션 적용, 테스터 계정 생성 등)도 이 동일한 프로젝트에다
직접 했다. 즉 "값이 달라서" 나는 문제가 아니라 전부 **"애초에 못 받아서"** 나는 문제였다
(3절). 값 자체를 손댈 필요는 없다.

---

## 5. Supabase Auth 리다이렉트 허용 목록

카카오 로그인 콜백(`/auth/callback`)이 동작하려면 Supabase 대시보드 →
Authentication → URL Configuration → Redirect URLs 에 그 도메인이 등록돼 있어야 한다.
2026-08-12 기준 등록된 것 (일부):

```
https://cardio.scnd.kr/auth/callback
https://app.cardio.club/auth/callback         (구 도메인, 하위호환용으로 남아있음)
https://cardio-staging-test.vercel.app/auth/callback
com.reshw.cardio://login-callback             (네이티브 앱)
com.reshw.cardio://callback                   (네이티브 앱)
http://localhost:3000 / :5173 / :3003 / .../auth/callback  (로컬 개발용, 포트 여러 개)
```

새 staging 도메인을 쓰게 되면(`crd.scnd.kr` 등) 여기 먼저 등록해야 함 —
**등록 안 하면 로그인이 "무한로딩"처럼 보일 수 있다** (실제로는 카카오 프로필조회/RPC
쪽에서 걸리는 것과는 다른 문제라 증상만으로는 구분이 안 된다 — 6절 참고).

> ⚠️ **`supabase/config.toml`의 `additional_redirect_urls`는 로컬 개발용 URL만 있고
> stale하다** (실제 원격 설정과 다름 — 위 목록엔 있는 프로덕션/staging 도메인이 파일엔
> 없음). **`supabase config push`를 이 상태로 실행하면 원격의 실제 허용 목록이 로컬의
> stale한 localhost-only 목록으로 덮어써져서 프로덕션 로그인이 통째로 깨진다.** 리다이렉트
> URL을 추가/변경할 땐 Supabase 대시보드에서 직접 하고, config.toml 은 건드리지 않는다
> (또는 먼저 원격 상태를 config.toml에 정확히 반영한 뒤에만 push).

---

## 6. 카카오 로그인이 "무한 로딩"처럼 보이는 두 가지 다른 원인

증상은 똑같이 "로그인 처리 중..."에서 안 넘어가는데, 원인이 완전히 다르다.

1. **리다이렉트 URL 미등록** (5절) — Supabase가 콜백 자체를 거부/무시.
2. **콜백 이후 단계 행(hang)** — `KakaoCallback.tsx`가 `processed.current = true`를
   제일 먼저 세팅해두고 카카오 프로필조회 → 계정연결 RPC → 세션갱신을 순서대로 기다리는데,
   이 중 하나라도 응답 없이 멈추면 30초 타임아웃도 다시 안 걸린다(그 타임아웃은
   `!processed.current`일 때만 발동하는데 이미 true라서). **에러 표시 없이 영원히 멈춘다.**
   2026-08-12에 각 단계에 자체 타임아웃을 걸어 수정함 — 카카오 프로필조회/세션갱신은
   실패해도 로그인 진행, 계정연결 RPC는 실패 시 명확한 에러 표시.

디버깅할 땐 브라우저 콘솔의 `[KakaoCallback]` 로그와 `diagLog`(사용설명 페이지 등에서
확인 가능) 를 먼저 볼 것 — 어느 단계에서 멈췄는지 나온다.
