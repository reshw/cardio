# 다운로드 페이지 개편 — APK 직접 다운로드 → Play 내부테스트 opt-in

- 근거: cardio-comms msg #32 (from `and`, 2026-07-28)
- 대상 파일: `src/pages/Download.tsx` (라우트 `/download`, App.tsx:186)

## 배경

- 기존: `deploy.py` → debug APK를 Supabase Storage(`apk/cardio-latest.apk`)에 덮어쓰기 → `app_releases` android row insert → `/download` 에서 그 url 로 APK 직접 다운로드
- 신규: GitHub Actions CI → 서명된 release AAB → **Google Play Console 내부 테스트 트랙** 자동 업로드 (현재 v8.61)
- 이제 사용자 동선: opt-in 링크로 테스터 등록 → Play 스토어에서 설치 → 이후 자동 업데이트

## 현재 DB 상태 (`app_releases`)

- android 최신 row: id=44, version `8.60`, url = Supabase Storage APK 고정 URL (2026-07-21)
- 테이블은 upsert 가 아니라 **insert 누적** 구조. 페이지는 `released_at` 내림차순 첫 android row 사용
- ios: id=5, version `1.0`, App Store 링크 (변경 없음)

## 설계 결정

1. **DB 주도 유지** — 버전/링크를 코드에 하드코딩하지 않고 계속 `app_releases` 에서 읽는다. `and` 쪽 CI 가 릴리스마다 row 만 추가하면 웹 배포 없이 반영됨.
2. **`url` 컬럼 의미 변경** — android 의 `url` 은 이제 "APK 파일"이 아니라 "**Play 내부테스트 opt-in 링크**". 스키마 변경 없음.
3. **링크 유효성 가드** — opt-in 링크(msg #32 기준 아직 미전달)가 DB 에 들어오기 전까지 잘못된 안내를 하지 않도록, android url 이 `play.google.com` 호스트일 때만 신청 버튼을 활성화. 아니면 "테스터 신청 링크 준비 중" 안내 노출. → opt-in row 가 들어오는 순간 코드 수정 없이 자동 활성화.

## 변경 내역 (Download.tsx, Android 카드만) — 완료

- [x] 버튼 문구 `APK 다운로드` → `Play 테스터 신청하기`, `download` 속성 제거하고 `target="_blank" rel="noopener noreferrer"` 로 변경
- [x] 설치 절차 안내 3단계 추가
  1. 아래 버튼으로 테스터 신청(“테스터 되기” 클릭)
  2. Play 스토어에서 **Cardio 설치**
  3. 이후 업데이트는 Play 스토어에서 자동
- [x] 신청 후 바로 안 보일 수 있음(반영에 몇 분 소요) 안내 문구
- [x] 헬스커넥트 안내 문구는 유지
- [x] url 이 Play 링크가 아닐 때의 fallback UI ("테스터 신청 링크 준비 중입니다")
- [x] iOS 카드 변경 없음
- [x] (추가) `app_releases` 조회 error 무시하던 것 → CLAUDE.md 에러 규칙대로 원인 노출하도록 수정

## DB 작업

- [ ] android v8.61 row insert — **opt-in 링크 수신 후**에 진행 (현재 미전달로 보류)
  ```
  insert into app_releases (platform, version, url, released_at)
  values ('android', '8.61', '<PLAY_OPTIN_URL>', now());
  ```

## `and` 에게 회신할 내용

- opt-in 링크 전달 요청 (`https://play.google.com/apps/internaltest/...`)
- 앞으로 CI 에서 릴리스마다 `app_releases` android row insert(version + 동일 opt-in url) 해달라는 요청 — 그러면 웹 배포 없이 버전 표기 자동 갱신
- 링크 도착 전까지는 페이지가 "준비 중" 으로 뜬다는 점 안내

## 검증

- [x] `npm run build` 통과 (2026-07-28, 8.15s)
- [ ] `/download` 렌더 확인 (링크 없을 때 fallback / 있을 때 버튼)
