# 바텀시트 모달 가이드

새 바텀시트/모달을 만들 때 헤더를 매번 새로 디자인하지 말고 이 문서의 기존 패턴을 그대로 갖다 쓴다.
2026-08 기준 `feedback-overlay` 를 쓰는 시트 12개 전수 조사 결과.

---

## 1. 공통 뼈대 — 모든 시트가 이거다

```tsx
return createPortal(
  <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
    <div className="feedback-sheet 내-시트-이름" onClick={(e) => e.stopPropagation()}>
      <div className="feedback-handle" />
      {/* 헤더 — 아래 2절 참고 */}
      {/* 본문 */}
    </div>
  </div>,
  document.body
);
```

- `feedback-overlay` / `feedback-sheet` / `feedback-handle` 는 절대 새로 안 만든다. `App.css` 에 이미 있다.
- **반드시 `createPortal(..., document.body)`** — 부모 stacking context에 갇혀 Android WebView에서 z-index 깨짐 ([CLAUDE.md](../CLAUDE.md) 참고).
- 오버레이 `onClick` 은 `e.stopPropagation()` 먼저 — 시트 쪽 클릭이 오버레이까지 버블링해서 닫히는 걸 막는다.
- 시트 자체에 커스텀 클래스(`내-시트-이름`)를 하나 추가로 붙여서 그 시트만의 폭/패딩 등을 스코프. `feedback-sheet` 자체를 건드리지 않는다.

---

## 2. 헤더 — 3가지 변형, 새로 만들지 말고 골라 쓸 것

### 2-1. 가운데 정렬 타이틀 (제일 많이 씀 — 7/12개)

CalendarPickerSheet, DatePickerSheet, ValuePickerSheet, MemberPickerSheet, CreateEventSheet,
EventDetailSheet, CheckinApprovalSheet 전부 이 패턴.

```tsx
<div className="race-modal-header">
  <div style={{ width: 32 }} />
  <span className="date-picker-title">{제목}</span>
  <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
</div>
```

`width: 32` 스페이서는 오른쪽 닫기 버튼(32px)과 폭을 맞춰서 타이틀이 진짜 가운데 오게 하는 트릭이다 —
`justify-content: space-between` 인 `.race-modal-header` 에서 양쪽 요소 폭이 같아야 가운데 정렬이 됨. 지우면 타이틀이 살짝 왼쪽으로 쏠린다.
**닫기 버튼 크기를 바꾸면 이 스페이서 값도 반드시 같이 바꿀 것** (2026-08-11: 28→32 변경 시 8개 파일 전부 같이 고쳤음).

**제목이 길어질 수 있으면 (동적 문자열 등)** 이 패턴을 쓰되 `date-picker-title` 에 `text-overflow: ellipsis` 가 이미 적용돼 있으니 별도 처리 불필요.

### 2-2. 왼쪽 정렬 타이틀 (h3, 폼 계열 모달 — 4/12개)

AddRaceModal, TeamAssignModal, ChallengeCreateModal, ChallengeJoinModal.

```tsx
<div className="race-modal-header">
  <h3>{제목}</h3>
  <button className="race-modal-close" onClick={onClose}><X size={20} /></button>
</div>
```

`.race-modal-header` 자체가 `justify-content: space-between` 이라 스페이서 없이 h3가 왼쪽, 닫기 버튼이 오른쪽에 붙는다.
닫기 아이콘은 텍스트 "✕" 대신 `lucide-react` 의 `<X size={20} />` 를 쓴다 — 이 변형만 그렇다, 섞지 말 것.

**언제 2-1 대신 이걸 쓰나:** 폼 입력이 메인인 모달(대회기록 추가, 챌린지 만들기 등)이고 제목이 항상 고정 문자열일 때.
동적으로 값이 붙는 제목(행사 상세, 참가자 확인 등)은 2-1을 쓴다 — 실제로 그렇게 갈려 있다.

### 2-3. 타이틀+서브타이틀 (FeedbackModal 전용 — 1/12개)

```tsx
<div className="feedback-sheet-header">
  <div>
    <div className="feedback-sheet-title">{제목}</div>
    <div className="feedback-sheet-sub">{보조 설명}</div>
  </div>
  <button className="feedback-close-btn" onClick={onClose}>✕</button>
</div>
```

이건 FeedbackModal만 쓴다. 제목 밑에 한 줄 설명이 꼭 필요한 경우가 아니면 2-1/2-2를 쓴다 — 새 시트에 이 패턴을
가져다 쓰지 말 것 (지금까지 아무도 안 그랬다).

---

## 3. 닫기 버튼(`.race-modal-close`) 스타일은 전역 하나로 통일돼 있다

과거엔 `.calendar-picker-sheet .race-modal-close` 에만 원형 배경 + hover 효과가 스코프돼 있어서
시트마다 닫기 버튼 생김새가 달랐다 (2026-08-11 발견·수정). 지금은 `.race-modal-close` 베이스 규칙 자체가
32×32 원형 + hover 배경을 갖고 있어서 **모든 시트가 자동으로 통일**된다.

```css
/* App.css — 시트별로 다시 정의하지 말 것 */
.race-modal-close {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 20px;
  transition: background 0.15s;
}
.race-modal-close:hover { background: var(--hover-overlay); }
```

새 시트 만들 때 `.race-modal-close` 를 시트별로 오버라이드하고 싶어지면 — 대부분 그럴 필요 없다.
정말 특수한 케이스(색이 배경과 겹쳐서 안 보인다 등)가 아니면 베이스 스타일 그대로 쓴다.

(참고로 `.feedback-close-btn` (FeedbackModal 전용, 2-3 패턴)도 같은 32×32 크기다 — `font-size`만 18px로 살짝 다름.)

---

## 4. 상단 고정(핸들 + 헤더) — 건드리면 반드시 깨지는 부분

`.feedback-sheet` 자체가 `overflow-y: auto` 스크롤 컨테이너라서, 핸들·헤더를 그냥 flex 자식으로 두면
내용이 길 때 스크롤한 만큼 같이 위로 밀려 올라가버린다. 그래서 **핸들과 헤더 둘 다 sticky** 로 고정돼 있다.

**새 시트를 만들 때는 `.feedback-handle` + `.race-modal-header`(또는 `.feedback-sheet-header`) 를
그대로 쓰기만 하면 자동으로 다 된다 — 시트 쪽에서 따로 할 것 없음.** 아래는 왜 이 값들인지에 대한 기록이라,
**이 계산을 깨뜨리는 수정(특히 `gap`/`padding` 변경)을 할 때만** 읽으면 된다.

### 4-1. 함정 ①: sticky `top` 의 기준선은 padding box 가 아니라 **content box** 다

이게 이 구조에서 제일 많이 틀리는 지점이다. 시트에 `padding-top: 12px` 가 있을 때 헤더에 `top: 0` 을 주면
**시트 맨 위가 아니라 그 12px 아래에 멈춘다.** 그러면 위쪽 12px 띠가 아무에게도 안 덮여서,
**스크롤되는 본문이 그 틈으로 헤더 위에 비쳐 보인다.** (2026-08-12 브라우저 실측으로 확인 —
기존 CSS: 틈 12px + 본문 노출 / 수정 후: 틈 0.)

> 처음엔 이걸 Safari 리페인트 버그로 오진해 `translateZ(0)` 를 붙였고, 그 다음엔 배경 스크롤/스크롤
> 체이닝 문제로 오진했다. **셋 다 원인이 아니었다.** 순수하게 sticky 기준선 문제다.

### 4-2. 지금 구조 (2026-08-12 기준)

```
.feedback-sheet   padding-top: 12px, gap: 16px, overflow-y: auto
├─ .feedback-handle   sticky, top: 0,  z-index: 3   → 항상 y=12 에 고정
└─ .race-modal-header sticky, top: 8px + gap, z-index: 2 → 원래 자리에 고정(안 움직임)
                      + box-shadow 로 자기 위쪽 전부를 시트 배경색으로 덮음
```

- **핸들**: 자기 원래 위치가 곧 stick 지점이라 처음부터 끝까지 제자리. 헤더 배경 위에 보여야 하므로 `z-index: 3`.
- **헤더**: `top` 을 **자기 원래 위치**(`핸들 4px + 핸들 아래 여백 4px + 시트 gap`)로 주면
  스크롤해도 **위로 딸려 올라가지 않는다**. `top: 0` 을 주면 스크롤 시 헤더가 위로 튀어 올라간다.
- **헤더 위쪽 덮개**: `box-shadow: 0 -(padding-top + 8px + gap) 0 0 var(--card-bg)`.
  `margin`/`padding` 으로 덮으면 정지 상태 레이아웃이 밀리는데, **box-shadow 는 레이아웃에 영향이 없어서**
  기존 간격을 픽셀 하나 안 건드리고 틈만 막는다.

### 4-3. 그래서 `gap`/`padding` 은 변수로만 바꾼다

헤더의 `top`·`box-shadow` 가 시트의 `padding-top`·`gap` 값을 알아야 계산되므로, App.css 에서 이렇게 노출해뒀다.

```css
.feedback-sheet {
  --sheet-pad-top: 12px;
  --sheet-pad-x: 20px;
  --sheet-gap: 16px;
  padding: var(--sheet-pad-top) var(--sheet-pad-x) calc(24px + env(safe-area-inset-bottom));
  gap: var(--sheet-gap);
}
```

> ⚠️ **시트별로 간격을 바꿀 땐 `gap:` / `padding:` 을 직접 쓰지 말고 `--sheet-gap` / `--sheet-pad-top`
> 을 덮어쓴다.** 직접 쓰면 헤더 고정 계산이 어긋나서 4-1 의 틈이 다시 생긴다.

```css
/* 올바름 */
.내-시트-이름 { --sheet-gap: 0px; }

/* 금지 — 헤더 계산이 어긋남 */
.내-시트-이름 { gap: 0; }
```

현재 이렇게 덮어쓰고 있는 시트: `event-detail`(14px) · `challenge-create`(20px) · `team-assign`(12px) ·
`challenge-join`(0) · `date-picker`(0, `--sheet-pad-top` 도 0).

### 4-4. 검증 방법 (다음에 또 만졌을 때)

눈으로 보지 말고 **콘솔에서 실측**한다. 시트를 열고 스크롤을 여러 단계로 옮기며 아래를 확인:

```js
// 헤더/핸들이 스크롤에 따라 움직이면 실패 (둘 다 0 이어야 함)
const s = document.querySelector('.feedback-sheet');
const t = s.querySelector('.race-modal-header span, .race-modal-header h3');
const tops = [0, 60, 150, 300].map(y => { s.scrollTop = y; return Math.round(t.getBoundingClientRect().top); });
Math.max(...tops) - Math.min(...tops);   // → 0
```

틈(본문 비침) 여부는 **`elementFromPoint` 로 판정하면 안 된다** — box-shadow 는 hit-test 대상이 아니라
콘텐츠가 잡혀서 오탐이 난다. **스크롤한 상태의 스크린샷으로 눈으로 확인**할 것.

---

## 5. 체크리스트 (새 시트 만들 때)

- [ ] `feedback-overlay` / `feedback-sheet` / `feedback-handle` 그대로 사용, 새로 안 만듦
- [ ] 헤더는 2-1 또는 2-2 중 하나 그대로 복붙 (동적 제목이면 2-1, 고정 짧은 제목 폼이면 2-2)
- [ ] `.race-modal-close` 커스텀 스타일 추가 안 함, 스페이서 폭도 안 건드림
- [ ] `createPortal(..., document.body)` 사용
- [ ] `max-height` 는 `%` 로 (vh/dvh 금지 — [CLAUDE.md](../CLAUDE.md) Android WebView 규칙)
- [ ] `position: fixed` 오버레이는 `inset: 0` 만, height 중복 지정 안 함
- [ ] 간격 조정이 필요하면 `gap:`/`padding:` 직접 쓰지 말고 `--sheet-gap`/`--sheet-pad-top` 덮어쓰기 (4-3)
- [ ] 시트 열고 스크롤해서 **헤더·핸들이 안 움직이는지 + 헤더 위로 본문이 안 비치는지** 확인 (4-4)
