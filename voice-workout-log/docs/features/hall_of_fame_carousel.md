# Hall of Fame Carousel - 명예의 전당 개편

**작업 완료일**: 2026-01-21
**작업자**: Claude Code
**버전**: 2.0

---

## 📋 작업 개요

클럽 대시보드의 "명예의 전당(Hall of Fame)" 위젯을 **Carousel(슬라이드)** 형태로 전면 개편하여:
1. 다수 멤버의 성과를 동시에 보여주고
2. **접속한 본인(Me)의 배지를 최우선으로 노출**하여 "나도 주인공"이라는 느낌 제공

---

## 🎯 문제점 및 해결책

### Before (기존)

**문제점**:
- ❌ Grid 레이아웃으로 단 1명의 1등만 표시
- ❌ 다수 유저 동기 부여 실패
- ❌ 공간 낭비 (한 화면에 1-2개만 보임)
- ❌ 본인이 1등이 아니면 소외감

### After (개선)

**해결책**:
- ✅ Carousel(슬라이드) UI로 여러 배지 동시 노출
- ✅ 한 유저가 여러 배지 받을 수 있음 (6가지 배지)
- ✅ **Me-first Sorting**: 본인 배지를 맨 앞에 배치
- ✅ Snap Scroll + Peeking으로 UX 향상

---

## 🏆 6가지 배지 시스템

모든 배지는 **주간 데이터(최근 7일)** 기준으로 계산됩니다.

| 배지 | 아이콘 | 타입 | 조건 | 설명 |
|------|--------|------|------|------|
| **워커홀릭** | 🔥 | effort | 총 운동 횟수 1위 | "주간 N회 운동" |
| **미라클 모닝** | 🌅 | time | 04-08시 운동 횟수 1위 | "새벽 N회 운동" |
| **올빼미 파수꾼** | 🦉 | time | 22-03시 운동 횟수 1위 | "심야 N회 운동" |
| **3대 500 꿈나무** | 🏋️ | strength | 총 볼륨(kg) 1위 | "총 볼륨 X.Xt" |
| **지칠 줄 모르는 심장** | 🏃 | cardio | 환산 거리(km) 1위 | "총 거리 X.Xkm" |
| **설원의 지배자** | 🏂 | consistency | 스노보드 런 수 1위 | "총 N런 완주" |

---

## 🎨 배지 타입별 색상 시스템

| 타입 | 색상 | 적용 배지 |
|------|------|-----------|
| `strength` | #ef4444 (Red) | 3대 500 꿈나무 |
| `cardio` | #3b82f6 (Blue) | 지칠 줄 모르는 심장 |
| `effort` | #eab308 (Yellow) | 워커홀릭 |
| `time` | #f97316 (Orange) | 미라클 모닝, 올빼미 파수꾼 |
| `consistency` | #8b5cf6 (Purple) | 설원의 지배자 |

---

## 🔧 구현 상세

### 1. 데이터 구조

**파일**: `src/utils/dashboardLogic.ts`

#### HofBadge 인터페이스

```typescript
export type BadgeType = 'strength' | 'cardio' | 'effort' | 'time' | 'consistency';

export interface HofBadge {
  userId: string;
  userName: string;
  userProfile: string | null;
  type: BadgeType; // 스타일링용
  title: string; // 예: "3대 500 꿈나무"
  icon: string; // 예: "🏋️"
  description: string; // 예: "총 볼륨 50,000kg 달성"
  value: string; // 표시용 값 (포맷팅된 문자열)
  isMe: boolean; // 정렬 최우선순위 플래그
  badgeId: string; // 고유 ID (userId + type)
}
```

#### calculateHofBadges() 함수

```typescript
export const calculateHofBadges = (
  members: WorkoutLog[],
  currentUserId?: string
): HofBadge[]
```

**알고리즘**:
1. 주간 데이터 필터링 (최근 7일)
2. 6가지 배지 각각 계산
3. 각 배지의 isMe 플래그 설정 (userId === currentUserId)
4. **Me-first Sorting**: isMe가 true인 배지를 맨 앞으로

---

### 2. UI 구현

**파일**: `src/pages/ClubDetail.tsx:667`

#### Carousel 컨테이너

```typescript
<div
  style={{
    display: 'flex',
    gap: '16px',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    paddingBottom: '8px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  }}
  className="hall-of-fame-carousel"
>
```

**특징**:
- `scrollSnapType: 'x mandatory'`: 카드별 Snap Scroll
- `overflowX: 'auto'`: 가로 스크롤
- `scrollbarWidth: 'none'`: 스크롤바 숨김 (깔끔한 UI)

#### 카드 디자인

```typescript
<div
  style={{
    minWidth: '280px',
    maxWidth: '280px',
    scrollSnapAlign: 'start',
    background: badge.isMe
      ? `linear-gradient(135deg, ${color}33 0%, ${color}22 100%)`
      : `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
    border: badge.isMe
      ? `3px solid ${color}`
      : `2px solid ${color}66`,
    boxShadow: badge.isMe ? `0 0 20px ${color}44` : 'none',
  }}
>
```

**차별화**:
- **Me 카드**: 진한 배경, 두꺼운 테두리(3px), 글로우 효과
- **Others 카드**: 연한 배경, 얇은 테두리(2px), 글로우 없음

#### Me 뱃지

```typescript
{badge.isMe && (
  <div style={{
    position: 'absolute',
    top: '12px',
    left: '12px',
    background: color,
    color: 'white',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '700',
  }}>
    ⭐ ME
  </div>
)}
```

---

### 3. CSS 스타일

**파일**: `src/App.css` (끝에 추가)

```css
/* Hall of Fame Carousel Styles */
.hall-of-fame-carousel {
  -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
}

/* Hide scrollbar for Chrome, Safari and Opera */
.hall-of-fame-carousel::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.hall-of-fame-carousel {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
```

---

## 📊 사용자 경험 흐름

### 시나리오 1: 내가 배지를 받았을 때

```
사용자 로그인 (Alice)
  ↓
Hall of Fame 로드
  ↓
calculateHofBadges(logs, "alice-id")
  ↓
결과: [
  { userId: "alice-id", title: "워커홀릭", isMe: true },  ← 맨 앞
  { userId: "bob-id", title: "3대 500 꿈나무", isMe: false },
  { userId: "alice-id", title: "미라클 모닝", isMe: true }, ← 두 번째
  ...
]
  ↓
Me-first Sorting 적용
  ↓
최종: [
  { Alice - 워커홀릭 ⭐ME },        ← 첫 카드 (진한 강조)
  { Alice - 미라클 모닝 ⭐ME },     ← 두 번째 (진한 강조)
  { Bob - 3대 500 꿈나무 },          ← 세 번째
  ...
]
```

**UX**:
- ✨ 첫 카드가 "나"의 배지 → 즉시 성취감
- ✨ 좌우 스크롤하면 내 다른 배지도 확인
- ✨ 진한 색상 + 글로우 효과로 주인공 느낌

### 시나리오 2: 내가 배지가 없을 때

```
사용자 로그인 (Charlie, 신규 멤버)
  ↓
calculateHofBadges(logs, "charlie-id")
  ↓
결과: [
  { Bob - 워커홀릭 },
  { Alice - 3대 500 꿈나무 },
  { David - 설원의 지배자 },
  ...
]
  ↓
Charlie의 배지 없음 → 다른 멤버들만 표시
```

**UX**:
- 📢 "다른 멤버들이 이런 성과를 냈어요!"
- 🎯 동기 부여: "나도 배지를 받고 싶다!"

---

## 🎨 시각적 차별화

### Me 카드 vs Others 카드

| 요소 | Me | Others |
|------|-----|--------|
| **배경 불투명도** | 33% → 22% | 22% → 11% |
| **테두리 두께** | 3px | 2px |
| **테두리 불투명도** | 100% | 66% |
| **글로우 효과** | `0 0 20px ${color}44` | 없음 |
| **Me 뱃지** | ⭐ ME (표시) | 없음 |

### 배지 아이콘 표시

- **우측 상단**: 큰 아이콘 (32px, 30% 투명도) - 배경 장식용
- **유저 이름 아래**: 작은 아이콘 + 타이틀 텍스트 - 정보 전달용

---

## 🚀 성능 최적화

### useMemo로 재계산 방지

```typescript
const currentUserId = useMemo(() => {
  const userStr = localStorage.getItem('current_user');
  if (!userStr) return undefined;
  try {
    const user = JSON.parse(userStr);
    return user.id;
  } catch {
    return undefined;
  }
}, []);

const badges = useMemo(
  () => calculateHofBadges(members, currentUserId),
  [members, currentUserId]
);
```

### CSS Snap Scroll

- JavaScript 없이 순수 CSS로 구현
- 부드러운 스크롤 애니메이션
- 모바일 터치 최적화 (`-webkit-overflow-scrolling: touch`)

---

## 📱 반응형 디자인

### 카드 크기

- **고정**: `minWidth: 280px`, `maxWidth: 280px`
- **Peeking**: 다음 카드가 우측에 16px 보임
- **모바일**: 한 화면에 1.2개 카드 (Peeking 효과)
- **태블릿/데스크톱**: 한 화면에 2-3개 카드

### 스크롤 힌트

```typescript
{badges.length > 1 && !badges[0].isMe && (
  <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
    ← 좌우로 스크롤하여 더 많은 배지를 확인하세요 →
  </div>
)}
```

- 첫 번째 카드가 Me가 아닐 때만 표시
- 사용자에게 스크롤 가능함을 알림

---

## 🔮 향후 확장 가능성

### 1. 배지 추가

```typescript
// 예시: 새로운 배지 추가
const findConsistencyKing = (logs, currentUserId) => {
  // 연속 출석 일수 계산
  return {
    type: 'consistency',
    title: '철인',
    icon: '🛡️',
    description: '7일 연속 출석',
    ...
  };
};
```

### 2. 배지 등급 시스템

```typescript
interface HofBadge {
  // ...
  grade?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

// 등급별 색상 차별화
const getBadgeGradeColor = (grade) => {
  switch (grade) {
    case 'platinum': return '#E5E4E2';
    case 'gold': return '#FFD700';
    case 'silver': return '#C0C0C0';
    case 'bronze': return '#CD7F32';
  }
};
```

### 3. 애니메이션 효과

```css
.hall-of-fame-carousel > div {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.hall-of-fame-carousel > div:hover {
  transform: scale(1.05);
}
```

### 4. 배지 상세 모달

- 카드 클릭 → 배지 상세 정보 모달
- 역대 수상자 목록
- 달성 조건 및 팁

---

## ✅ 체크리스트

- [x] HofBadge 인터페이스 정의
- [x] calculateHofBadges() 함수 구현
- [x] 6가지 배지 로직 구현
- [x] Me-first Sorting 구현
- [x] Carousel UI 구현
- [x] Snap Scroll 적용
- [x] 배지 타입별 색상 차별화
- [x] Me 카드 강조 스타일
- [x] CSS 스크롤바 숨김 처리
- [x] 스크롤 힌트 텍스트
- [x] useMemo 최적화
- [x] 빌드 테스트 통과
- [x] 문서 작성

---

## 📁 변경된 파일

### 1. src/utils/dashboardLogic.ts
- `HofBadge` 인터페이스 추가
- `calculateHofBadges()` 함수 추가
- 6가지 Helper 함수 추가:
  - `findWorkaholic()`
  - `findEarlyBirdBadge()`
  - `findNightOwl()`
  - `findVolumeKingBadge()`
  - `findCardioKing()`
  - `findSlopeMaster()`

### 2. src/pages/ClubDetail.tsx
- import 변경: `calculateTitles` → `calculateHofBadges`
- `HallOfFame` 컴포넌트 전면 리팩토링:
  - Grid → Carousel
  - currentUserId 로직 추가
  - Me 뱃지 표시
  - 배지 타입별 색상
  - Snap Scroll 적용

### 3. src/App.css
- `.hall-of-fame-carousel` 클래스 추가
- 스크롤바 숨김 처리

---

## 📚 관련 문서

- [클럽 대시보드 위젯 시스템](./club_dashboard_widgets.md)
- [Smart Active Squad 구현](./smart_active_squad_implementation.md)

---

**Status**: ✅ 완료
**Build**: ✅ 통과 (719.73 kB)
**Type Check**: ✅ 통과
**주요 개선**: 단일 1등 표시 → 6가지 배지 Carousel + Me-first Sorting
