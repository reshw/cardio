# 기록 입력 제한일수 어드민 관리 기능

날짜: 2026-07-08 / 상태: 구현 완료 (dev 커밋)

확정 사항: 어드민 메뉴는 **슈퍼어드민 전용** 배치. sim-running-card.* 파일은 .gitignore 처리.

## 배경

AddWorkout의 날짜 입력이 현재 **당일 포함 3일 구간(48시간)** 으로 하드코딩되어 있음.
과거 기록을 일시적으로 열어야 할 때(예: 지난 기록 소급 입력) 코드 수정·배포 없이
어드민 페이지에서 제한을 조정할 수 있게 한다.

현재 하드코딩 위치:
- `src/pages/AddWorkout.tsx:249` — 제출 시 48시간 초과 검증 (`48 * 60 * 60 * 1000`)
- `src/components/DatePickerSheet.tsx` — 오늘/어제/이틀 전 3개 탭 고정 (`0 | 1 | 2` 타입)

## 설계

### 1. 설정 저장 — `system_settings` 재사용 (마이그레이션 불필요)

기존 `system_settings` key-value 테이블 사용 (이미지 업로드 설정과 동일 패턴).
- key: `workout_entry_limit`
- value: `{ "days": 3 }` — 당일 포함 허용 일수. `null` = 제한 없음
- 행이 없으면 코드 기본값 3 사용 → DB 마이그레이션 없음
- RLS: 공개 읽기 이미 활성, 쓰기는 앱 레벨 어드민 체크 (기존 정책 그대로)

### 2. 검증 로직 변경 — 롤링 48시간 → 달력일 기준

현재는 "지금으로부터 48시간"이라 3일 전 밤 기록이 애매하게 걸림.
설정값 도입과 함께 **달력일 기준**으로 통일:
`days = 3` → 오늘 00:00 기준 2일 전 00:00부터 허용 (당일 포함 3일).
alert 문구도 동적으로: `"N일 이전 기록은 추가할 수 없습니다."`

### 3. 파일별 변경

| 파일 | 변경 |
|---|---|
| `src/services/settingsService.ts` (신규) | `getWorkoutEntryLimitDays(): Promise<number \| null>` — system_settings 조회, 실패/부재 시 3 |
| `src/pages/AddWorkout.tsx` | 마운트 시 limit 조회 → 제출 검증을 달력일 기준 동적 검증으로 교체, DatePickerSheet에 `maxDays` 전달 |
| `src/components/DatePickerSheet.tsx` | 3탭 고정 → `maxDays` prop 기반 동적 날짜 칩 (가로 스크롤). 라벨: 오늘/어제/이틀 전, 그 이후는 `M/D (요일)`. 무제한이면 최근 90일까지 칩 노출 (그 이전은 네이티브 datetime-local 픽커 경로로 입력 가능) |
| `src/pages/AdminEntryLimitSettings.tsx` (신규) | 프리셋 버튼: **3일(기본) / 7일 / 31일(한달) / 제한 없음** + 직접 입력(일수). 현재 설정 표시 + 저장 |
| `src/pages/AdminPage.tsx` | 어드민 메뉴에 "기록 입력 제한 설정" 항목 추가 |
| `src/App.tsx` | `/admin/entry-limit` 라우트 등록 |

### 4. 메모

- 네이티브 `showPicker()` 지원 브라우저는 datetime-local 픽커로 아무 날짜나 고를 수 있으므로 **제출 시 검증이 최종 방어선** (현재도 동일 구조).
- 수정 모드(editWorkout)는 지금처럼 날짜 제한 검증 없음 — 유지.
- 서버(웹훅: Strava/Health Connect 자동 기록)는 날짜 제한 대상 아님 — 클라이언트 수기 입력만 제한.
- 어드민 페이지 접근: `/admin` (More → 어드민 관리) 일반 어드민 메뉴에 배치. 슈퍼어드민 전용으로 올릴지는 확인 필요.

## 작업 순서

1. settingsService 신규 작성
2. AddWorkout 검증 교체 + limit 로딩
3. DatePickerSheet 동적 칩
4. AdminEntryLimitSettings 페이지 + 라우트 + 메뉴
5. `npm run build` 통과 확인 → dev 커밋
