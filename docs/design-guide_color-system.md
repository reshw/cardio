# 컬러 · 테마 시스템 가이드

이 앱의 색상은 **CSS 변수 토큰 + `[data-theme]` 오버라이드** 구조다.
새 테마 추가, 색상 하드코딩 정리, 다크모드 대응 작업을 할 때 이 문서를 먼저 본다.

- 토큰 정의: [src/App.css](../src/App.css) 최상단 `:root` / `[data-theme='dark']`
- 테마 상태: [src/hooks/useTheme.ts](../src/hooks/useTheme.ts)
- FOUC 방지: [index.html](../index.html) 인라인 스크립트 (React 부팅 전 실행)
- 도입 경위·결정 기록: [docs/plans/dark-theme.md](plans/dark-theme.md)

---

## 1. 핵심 원칙 — "전부 토큰화"는 오답이다

색상 하드코딩을 전부 변수로 바꾸려 하면 안 된다. 기준은 하나다:

> **테마에 따라 값이 달라져야 하는가?**

| 분류 | 예시 | 처리 |
|---|---|---|
| **구조색** — 표면·글자·테두리 | 흰 카드, 검은 글자, 회색 hover | **토큰화 필수** |
| **상태색** — 의미가 색에 묶임 | 에러 `#ef4444`, 성공 `#22c55e` | **그대로 둔다** (두 테마 공통) |
| **브랜드색** — 외부 서비스 | 카카오 `#FEE500`, Strava `#FC4C02` | **그대로 둔다** (바꾸면 오히려 틀림) |
| **컬러/이미지 위 요소** | 이미지뷰어 닫기 버튼, 슬라이더 손잡이 | **그대로 둔다** (배경이 이미 검정·컬러) |

실제 규모 감각 (2026-08 기준): App.css 12,930줄에 hex 251개 + rgba 179개, tsx 에 hex 314개.
이 중 **다크에서 실제로 깨지는 건 CSS 39곳 + tsx 51곳뿐**이었다. 나머지는 건드릴 필요가 없었다.

---

## 2. 토큰 카탈로그

### 기본 (원래부터 있던 것)

`--primary-color` `--primary-hover` `--secondary-color` `--secondary-hover` `--success-color`
`--bg-color` `--card-bg` `--card-hover-bg` `--text-primary` `--text-secondary`
`--border-color` `--input-bg` `--gradient-primary` `--gradient-light` `--shadow-sm/md/lg`

### 구조색 (다크 대응하며 신설)

| 토큰 | 언제 쓰나 | 라이트 | 다크 |
|---|---|---|---|
| `--body-bg` | body 배경 | 흰→하늘→핑크 | 딥네이비 |
| `--surface-translucent` | 헤더·바텀네비·고정바·sticky 헤딩 (blur 뒤 표면) | `rgba(255,255,255,.98)` | `rgba(23,26,33,.96)` |
| `--surface-elevated` | 컬러 배경 위에 얹히는 불투명 카드 | `#FFFFFF` | `#171A21` |
| `--surface-on-color` | 컬러/이미지 위 밝은 반투명 칩 (진행바 트랙 등) | 흰색 25% | 흰색 16% |
| `--scrim` | 모달 backdrop | 검정 50% | 검정 68% |
| `--wash` | 비활성 요소를 배경 쪽으로 바래게 덮는 막 | **흰색** 30% | **검정** 40% |
| `--hover-overlay` | hover 시 살짝 덮는 막 | **검정** 6% | **흰색** 8% |
| `--on-accent` | 강조색 배경 **위에 얹는 글자색** | `#FFFFFF` | `#0F1115` |
| `--danger-tint` / `--warning-tint` | 위험·주의 틴트 배경 | 파스텔 | 반투명 |
| `--gold-tint` / `--gold-border` | 명예의전당 | 파스텔 금색 | 반투명 금색 |
| `--row-hof/me/found-bg`·`-border` | 랭킹 행 강조(명전/나/검색결과) | 파스텔 | 반투명 |

> `--wash` 와 `--hover-overlay` 는 **라이트와 다크에서 방향이 뒤집힌다**(흰↔검정).
> 덮는 막 계열은 항상 이 점을 확인할 것.

---

## 3. 반드시 걸리는 함정 5가지

과거에 실제로 사고가 났거나, 놓칠 뻔한 지점들.

### ① 강조색 배경 + 흰 글자 = 다크에서 판독 불가

다크의 `--primary-color` 는 밝은 시안(`#5DD6FF`)이다. 그 위 흰 글자는 **대비 1.68:1**
(WCAG 최소 4.5:1 미달). 반드시 `--on-accent` 를 쓴다 → **11.27:1**.

```css
/* 금지 */
.some-button { background: var(--primary-color); color: #fff; }
/* 올바름 */
.some-button { background: var(--primary-color); color: var(--on-accent); }
```

도입 당시 이 조합이 **CSS 에만 46곳** 있었다.

### ② 배경은 인라인, 글자색은 CSS → 일괄 치환이 못 잡는다

아바타 플레이스홀더가 대표 사례. 배경은 tsx 인라인(`style={{ background: ... }}`),
글자색은 CSS(`.xxx-placeholder { color: white }`) 라서
"블록 안에 강조색 배경이 있으면 흰 글자를 바꾼다"는 스크립트가 통째로 놓쳤다.
**CSS 블록만 보고 판단하지 말 것.**

### ③ tsx 인라인 스타일이 CSS 를 이긴다

랭킹 행 강조는 `.ranking-item.hof-highlight` CSS 를 고쳐도 안 바뀌었다.
[Club.tsx](../src/pages/Club.tsx) 에 인라인 그라데이션이 박혀 있어서다.
**인라인 스타일에서도 토큰을 쓴다** — `background: 'var(--row-hof-bg)'`.

### ④ 불투명 파스텔은 다크에서 눈부시게 튄다

명전 카드(`#FFFBEA`), 강조 행(`#FFF9E6`) 같은 옅은 색 배경은 어두운 화면에서 밝은 덩어리로 튄다.
**"반투명 색 + 진한 테두리"** 패턴으로 바꾼다. `.hall-of-fame` 이 원래부터 이 방식이었으니
새로 디자인하지 말고 그 선례를 따를 것.

### ⑤ 입력창 `focus` 흰 배경 / hover 밝은 회색

`background: #FFFFFF` (focus), `background: #f8f8f8` (hover) 류는 다크에서 흰 판이 된다.
각각 `var(--card-bg)`, `var(--card-hover-bg)`.

---

## 4. 작업 절차 (다음에 이 작업을 또 할 때)

### STEP 1 — 조사: 어디가 깨지는지 먼저 센다

```bash
# 하드코딩 규모 파악
grep -oE "#[0-9a-fA-F]{3,8}\b" src/App.css | sort -u | wc -l
grep -rhoE "#[0-9a-fA-F]{3,8}\b" src --include="*.tsx" | sort -u | wc -l
```

```bash
# 흰 배경을 셀렉터와 함께 매핑 (라인번호 의존 X)
awk '
/^[^ \t}].*\{/ { sel=$0; gsub(/\s*\{.*/, "", sel) }
/(background|background-color):[^;]*(#[Ff][Ff][Ff]([Ff][Ff][Ff])?\b|white|255, ?255, ?255)/ {
  printf "%-6s %-48s %s\n", NR, sel, $0
}' src/App.css
```

```bash
# ①번 함정: 강조색 배경 + 흰 글자 조합 찾기
python - <<'PY'
import re
src = open('src/App.css', encoding='utf-8').read()
for sel, body in re.findall(r'([^{}]+)\{([^}]*)\}', src):
    bg = re.search(r'background(?:-color)?:\s*(var\(--(?:primary-color|secondary-color|gradient-primary)\)'
                   r'|linear-gradient[^;]*(?:4FC3F7|FF6B9D|667eea))', body, re.I)
    tx = re.search(r'(?<![-\w])color:\s*(white|#[Ff]{3}\b|#[Ff]{6}\b)', body)
    if bg and tx:
        print(' ', sel.strip().split('\n')[-1][:60])
PY
```

### STEP 2 — 치환: 셀렉터 기준으로, 라인번호로 하지 말 것

토큰을 추가하면 라인번호가 밀린다. 정규식은 **셀렉터를 앵커로** 잡는다.

```python
# 예: (\.menu-item-btn:hover\s*\{[^}]*?background:\s*)#f8f8f8  →  \1var(--card-hover-bg)
```

치환 전 `cp src/App.css <스크래치패드>/App.css.bak` 로 백업할 것.

### STEP 3 — 검증: 브라우저에서 실측한다. 눈으로만 보지 말 것

로컬 서버를 띄우고 실제 로그인 상태에서 아래를 실행하면
**남은 밝은 배경 + 저대비 요소**가 한 번에 나온다.

```js
(() => {
  const srgb = c => { c/=255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const relL = (r,g,b) => 0.2126*srgb(r)+0.7152*srgb(g)+0.0722*srgb(b);
  const parse = s => { const m=s.match(/[\d.]+/g); return m ? m.slice(0,3).map(Number) : null; };
  const lum = s => { const m=s.match(/[\d.]+/g); if(!m||m.length<3) return null;
    if(m.length>=4 && parseFloat(m[3])<0.2) return null;
    const [r,g,b]=m.map(Number); return 0.299*r+0.587*g+0.114*b; };
  const lightBg = new Set(), lowContrast = new Set();
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 12) return;
    const Lb = lum(cs.backgroundColor);
    if (Lb === null) return;
    const name = ((el.className||'').toString().slice(0,40) || el.tagName);
    if (Lb > 200) lightBg.add(name + ' :: ' + cs.backgroundColor);
    const bg = parse(cs.backgroundColor), tx = parse(cs.color);
    // 컨테이너에 직접 텍스트가 있을 때만 대비 판정 (자식에만 글자 있으면 오탐)
    const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (bg && tx && ownText) {
      const a = relL(...bg), b = relL(...tx);
      const [hi,lo] = a>b?[a,b]:[b,a];
      const ratio = (hi+0.05)/(lo+0.05);
      if (ratio < 3) lowContrast.add(name + ' ratio=' + ratio.toFixed(2));
    }
  });
  return JSON.stringify({ lightBg: [...lightBg], lowContrast: [...lowContrast] }, null, 2);
})()
```

**주의**: 위 스크립트는 `ownText` 체크가 없으면 오탐이 뜬다. 컨테이너의 `color` 는 상속만 하고
실제 글자는 자식에 있는 경우가 흔해서, 그때 컨테이너 배경 vs 컨테이너 color 비교는 의미가 없다.

검증은 **라이트/다크 양쪽 모두** 돌린다. 다크만 보면 라이트 회귀를 놓친다.

### STEP 4 — 체크리스트

- [ ] 라이트/다크 양쪽에서 위 감사 스크립트 통과
- [ ] 새로고침 시 흰 화면 번쩍임(FOUC) 없음
- [ ] 모달/바텀시트 backdrop, 헤더·바텀네비 반투명
- [ ] 피드/갤러리 카드, 랭킹 리스트, 명전 카드
- [ ] 상태색(미적립 배지, 에러 문구)이 다크에서도 읽히는지
- [ ] `npm run build` 통과

---

## 5. 새 테마를 추가하려면

1. `src/App.css` 에 `[data-theme='<이름>'] { ... }` 블록 추가 — `:root` 의 토큰을 전부 덮어쓴다
2. `src/hooks/useTheme.ts` 의 `Theme` 타입에 이름 추가, `applyTheme` 분기 추가
3. `index.html` 인라인 스크립트의 판정 로직 수정
   (**`THEME_KEY` 값이 `useTheme.ts` 와 반드시 같아야 함** — 다르면 FOUC 발생)
4. [More.tsx](../src/pages/More.tsx) "앱 설정" 섹션 UI 를 토글 → 선택형으로 변경

### 컬러피커(자유 색상 선택)를 요청받으면

지금 구조에서는 **권하지 않는다.** `--primary-color` 가 배경색과 글자색 양쪽으로 쓰여서,
사용자가 밝은 색을 고르면 버튼 글씨가 안 보이는 대비 사고가 난다.
꼭 해야 하면 **미리 검증한 프리셋 스와치 6~8개**로 제한하고, 각 프리셋마다
`--on-accent` 를 같이 정의해 대비를 보장할 것.

---

## 6. 범위 밖으로 남겨둔 것 (2026-08 기준)

다음에 이어서 할 때 참고.

- **어드민 3개 페이지** — `AdminWorkoutTypes`(구조색 11) / `AdminDemoUsers`(4) / `AdminStravaIntegrations`(1). 내부용이라 후순위
- **`/download`** — 앱 셸 밖 독립 공개 페이지, 자체 디자인 유지 중
- **슬라이더 손잡이·이미지뷰어 버튼 흰색 11곳** — 검정/컬러 배경 위라 양 테마 모두 흰색이 맞음 (고치면 안 됨)
