# 바텀시트 모달 디자인 가이드

> 챌린지 생성/참여 모달에 적용된 바텀시트 스타일 컴포넌트 패턴 정리
> 적용 시점: 2026-04-29 (커밋 `71b4d67`, `79be332`)

---

## 개요

기존 센터 팝업(centered modal) 방식에서 **모바일 친화적인 바텀시트(bottom sheet)** 방식으로 전환.
화면 하단에서 슬라이드업 되며, 드래그 핸들과 반투명 오버레이로 구성된다.

적용 컴포넌트:
- `ChallengeCreateModal` — 챌린지 생성
- `ChallengeJoinModal` — 챌린지 참여 선언

---

## HTML 구조

```tsx
{/* 반투명 배경 — 클릭 시 닫힘 */}
<div className="feedback-overlay" onClick={onClose}>
  {/* 바텀시트 본체 — 클릭 이벤트 버블링 차단 */}
  <div className="feedback-sheet [모달별-modifier]" onClick={(e) => e.stopPropagation()}>

    {/* 드래그 핸들 */}
    <div className="feedback-handle" />

    {/* 헤더: 뒤로가기 or 빈 공간 | 제목 | 닫기버튼 */}
    <div className="race-modal-header">
      <button className="race-modal-close" onClick={onClose}><X size={20} /></button>
    </div>

    {/* 콘텐츠 */}
    ...
  </div>
</div>
```

헤더는 항상 `left | center(제목) | right` 3-column 구조.
- 뒤로가기 step이 없으면 `<div style={{ width: 28 }} />`으로 좌측 공간을 채워 제목을 중앙 정렬.

---

## CSS 클래스 레퍼런스

### 공용 (모든 바텀시트에서 재사용)

| 클래스 | 역할 |
|---|---|
| `.feedback-overlay` | 풀스크린 반투명 배경 (`rgba(0,0,0,0.45)`), `z-index: 1100`, 하단 정렬 |
| `.feedback-sheet` | 시트 본체. `border-radius: 24px 24px 0 0`, `max-height: 92vh`, `slideUp` 애니메이션 |
| `.feedback-handle` | 상단 드래그 핸들 바 (`40×4px`, `var(--border-color)`) |
| `.race-modal-header` | 헤더 flex row (`justify-content: space-between`) |
| `.race-modal-close` | X 닫기 버튼 (아이콘만, 배경 없음) |
| `.race-form` | 폼 컨테이너 (`flex-col`, `gap: 16px`, `overflow-y: auto`) |
| `.race-form-row` | 2열 그리드 (`grid-template-columns: 1fr 1fr`) |
| `.race-form-group` | 라벨 + 인풋 묶음 (`flex-col`, `gap: 6px`) |
| `.race-input` | 범용 텍스트/날짜 인풋 (`border-radius: 10px`, focus 시 `--primary-color` 테두리) |

### 슬라이드업 애니메이션

```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

/* .feedback-sheet 에 적용 */
animation: slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
```

cubic-bezier 값 `(0.32, 0.72, 0, 1)`은 iOS 네이티브 시트 느낌을 근사한 커브.

---

## 챌린지 생성 모달 (`ChallengeCreateModal`)

**modifier 클래스:** `.challenge-create-sheet` (`gap: 20px`)

### 종목 범위 선택 — Scope Toggle

```
[ 전체 ] [ 직접 선택 ]
```

| 클래스 | 설명 |
|---|---|
| `.challenge-allowed-row` | 버튼 2개를 가로 배치 (`flex`, `gap: 8px`) |
| `.challenge-scope-btn` | 각 버튼 (`flex: 1`, `border-radius: 10px`, `border: 1.5px solid --border-color`) |
| `.challenge-scope-btn.active` | 선택 상태 (`--primary-color` 테두리 + 연한 배경 `rgba(79,195,247,0.08)`) |

### 종목 칩 선택 (직접 선택 시 노출)

```
[🏃 달리기] [🚴 자전거] [🏊 수영] ...
```

| 클래스 | 설명 |
|---|---|
| `.challenge-category-chips` | 칩 wrap 컨테이너 (`flex-wrap`, `gap: 8px`) |
| `.challenge-category-chip` | 개별 칩 (`border-radius: 20px`, pill 형태) |
| `.challenge-category-chip.active` | 선택 상태 (scope-btn.active와 동일 색상 시스템) |

### 제출 버튼

```
[ 챌린지 열기 ]
```

| 클래스 | 설명 |
|---|---|
| `.challenge-create-submit` | 풀너비, `var(--gradient-primary)` 배경, `border-radius: 12px`, `font-size: 15px/700` |
| `.challenge-create-submit:disabled` | `opacity: 0.6`, `cursor: not-allowed` |

---

## 챌린지 참여 모달 (`ChallengeJoinModal`)

**modifier 클래스:** `.challenge-join-sheet` (`gap: 0`)

2단계 스텝 구조로 운영된다.

### 스텝 구조

| Step | 화면 | 헤더 좌측 |
|---|---|---|
| `list` | 추가된 목표 목록 + 제출 | 빈 div(너비 28px) |
| `add` | 종목 선택 폼 | `<button .challenge-join-back-btn>` (ChevronLeft 아이콘) |

### 목표 목록 (list step)

| 클래스 | 설명 |
|---|---|
| `.challenge-join-body` | 콘텐츠 영역 (`padding: 0 20px 24px`, `overflow-y: auto`) |
| `.challenge-join-goals` | 목표 행들의 컨테이너 |
| `.challenge-join-goal-row` | 종목명 + 목표값 + 삭제버튼 한 행 |
| `.challenge-join-goal-name` | 종목 이름 (이모지 포함) |
| `.challenge-join-goal-value` | 숫자 + 단위 |
| `.challenge-join-goal-remove` | Trash2 아이콘 삭제버튼 (hover 시 빨간색) |
| `.challenge-join-add-btn` | "종목 추가하기 / 더 추가하기" 버튼 |

### 종목 추가 폼 (add step)

#### 기본운동 / 기타운동 섹션

기본운동(`is_core: true`)은 항상 펼쳐져 있고, 기타운동은 토글로 접힘/펼침.

| 클래스 | 설명 |
|---|---|
| `.challenge-join-section` | 섹션 컨테이너 (`flex-col`, `gap: 4px`) |
| `.challenge-join-section-label` | 섹션 제목 라벨 (`font-size: 13px`, `font-weight: 600`) |
| `.challenge-join-other-toggle` | 기타운동 접기/펼치기 버튼 (풀너비 flex, 우측에 ▶/▼ 표시) |

기타운동 토글 버튼 예시:
```tsx
<button className="challenge-join-other-toggle" onClick={() => setShowOtherWorkouts(!show)}>
  <span>📦 기타운동</span>
  <span>{show ? '▼' : '▶'}</span>
</button>
```

#### 목표값 입력

| 클래스 | 설명 |
|---|---|
| `.challenge-join-value-row` | 인풋 + 단위 라벨을 가로 배치 (`gap: 10px`) |
| `.challenge-join-value-input` | 숫자 인풋 (`flex: 1`) |
| `.challenge-join-unit` | 단위 텍스트 (km, 분 등, `white-space: nowrap`) |
| `.challenge-join-hint` | 기간 안내 힌트 텍스트 (`font-size: 12px`) |

---

## 컬러 토큰 요약

| 토큰 | 용도 |
|---|---|
| `var(--primary-color)` | 선택 상태 테두리, 포커스 색상 |
| `var(--gradient-primary)` | 제출 버튼 배경 |
| `var(--card-bg)` | 시트 배경 |
| `var(--input-bg)` | 인풋, 비활성 칩 배경 |
| `var(--border-color)` | 기본 테두리, 드래그 핸들 색상 |
| `var(--text-primary)` | 주요 텍스트 |
| `var(--text-secondary)` | 보조 텍스트, 라벨, 비활성 상태 |
| `rgba(79, 195, 247, 0.08)` | 선택 상태 칩/버튼 배경 (primary 색상 기반 10% 투명도) |
| `#ef4444` | 에러 메시지, 삭제 버튼 hover |

---

## 새 바텀시트 추가 시 체크리스트

1. 오버레이에 `feedback-overlay` 사용, 클릭 시 `onClose` 연결
2. 시트에 `feedback-sheet` + 모달별 modifier 클래스 추가
3. `feedback-handle` 을 시트 최상단에 배치
4. 헤더는 `race-modal-header` 패턴 (left | 제목 | 닫기) 유지
5. iOS safe area 고려 — `padding-bottom: calc(24px + env(safe-area-inset-bottom))` 적용됨 (feedback-sheet 기본값)
6. `max-height: 92vh` + `overflow-y: auto` 로 긴 콘텐츠 대응
7. 제출 버튼은 `challenge-create-submit` 재사용 가능 (공통 스타일)
