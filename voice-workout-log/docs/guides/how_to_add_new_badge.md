# 새로운 명예의 전당 배지 추가 가이드

**난이도**: ⭐⭐ (중급)
**소요 시간**: 10-15분
**수정 파일**: `src/utils/dashboardLogic.ts` (1개만!)

---

## 📋 개요

명예의 전당(Hall of Fame)에 새로운 배지를 추가하는 방법을 단계별로 설명합니다.
모든 로직은 **`src/utils/dashboardLogic.ts`** 파일에서 관리됩니다.

---

## 🎯 3단계 작업 흐름

```
1. Helper 함수 작성 (배지 계산 로직)
   ↓
2. calculateHofBadges()에 추가 (메인 함수에 등록)
   ↓
3. 테스트 및 빌드
```

---

## 📝 Step 1: Helper 함수 작성

### 위치
`src/utils/dashboardLogic.ts` 파일 **끝 부분**에 추가

### 템플릿

```typescript
// Helper: [배지 이름] ([조건 설명])
const find[BadgeName] = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  // 1. 유저별 데이터 집계용 Map 생성
  const userStats = new Map<
    string,
    { userName: string; userProfile: string | null; [metric]: number }
  >();

  // 2. 로그를 순회하며 유저별 통계 계산
  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userStats.get(log.userId) || {
      userName: log.userDisplayName,
      userProfile: log.userProfileImage || null,
      [metric]: 0,
    };

    // 3. 배지 조건에 맞는 데이터만 집계
    // [여기에 조건 로직 작성]

    userStats.set(log.userId, existing);
  });

  // 4. 순위 계산 (내림차순 정렬)
  const rankings = Array.from(userStats.entries())
    .filter(([_, data]) => data.[metric] > 0)
    .sort((a, b) => b[1].[metric] - a[1].[metric]);

  if (rankings.length === 0) return null;

  // 5. 1위 유저 선정
  const [userId, data] = rankings[0];

  // 6. HofBadge 객체 반환
  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: '[badge_type]', // 'strength' | 'cardio' | 'effort' | 'time' | 'consistency'
    title: '[배지 이름]',
    icon: '[이모지]',
    description: `[설명 템플릿 ${data.[metric]}]`,
    value: `${data.[metric]}[단위]`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-[badge_id]`,
  };
};
```

---

## 💡 실전 예시: "주말 전사" 배지 추가

### 요구사항
- **조건**: 주말(토요일+일요일)에 가장 많이 운동한 사람
- **타입**: `effort`
- **아이콘**: 🎖️
- **설명**: "주말 N회 운동"

### 구현 코드

```typescript
// Helper: WeekendWarrior (주말 운동 횟수 1위)
const findWeekendWarrior = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userWeekendCounts = new Map<
    string,
    { userName: string; userProfile: string | null; count: number }
  >();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    // 주말 체크 (0 = 일요일, 6 = 토요일)
    const dayOfWeek = new Date(log.createdAt).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) return; // 주말 아니면 스킵

    const existing = userWeekendCounts.get(log.userId) || {
      userName: log.userDisplayName,
      userProfile: log.userProfileImage || null,
      count: 0,
    };

    existing.count += log.workouts.length;
    userWeekendCounts.set(log.userId, existing);
  });

  const rankings = Array.from(userWeekendCounts.entries())
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'effort',
    title: '주말 전사',
    icon: '🎖️',
    description: `주말 ${data.count}회 운동`,
    value: `${data.count}회`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-weekendwarrior`,
  };
};
```

---

## 📝 Step 2: calculateHofBadges()에 추가

### 위치
`src/utils/dashboardLogic.ts`의 `calculateHofBadges()` 함수 내부

### 추가 방법

기존 코드:
```typescript
export const calculateHofBadges = (
  members: WorkoutLog[],
  currentUserId?: string
): HofBadge[] => {
  // 주간 데이터 필터링
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklyLogs = members.filter((log) => new Date(log.createdAt) >= sevenDaysAgo);

  const badges: HofBadge[] = [];

  // 1. Workaholic
  const workaholic = findWorkaholic(weeklyLogs, currentUserId);
  if (workaholic) badges.push(workaholic);

  // ... 기존 배지들 ...

  // 6. SlopeMaster
  const slopeMaster = findSlopeMaster(weeklyLogs, currentUserId);
  if (slopeMaster) badges.push(slopeMaster);

  // Me-first sorting
  return badges.sort((a, b) => {
    if (a.isMe && !b.isMe) return -1;
    if (!a.isMe && b.isMe) return 1;
    return 0;
  });
};
```

**여기에 추가:**
```typescript
  // 7. WeekendWarrior (새로 추가!)
  const weekendWarrior = findWeekendWarrior(weeklyLogs, currentUserId);
  if (weekendWarrior) badges.push(weekendWarrior);
```

---

## 🎨 배지 타입별 색상 가이드

UI에서 자동으로 타입에 맞는 색상이 적용됩니다:

| type | 색상 | Hex | 용도 |
|------|------|-----|------|
| `strength` | Red | #ef4444 | 근력 관련 배지 |
| `cardio` | Blue | #3b82f6 | 유산소 관련 배지 |
| `effort` | Yellow | #eab308 | 노력/횟수 관련 배지 |
| `time` | Orange | #f97316 | 시간대 관련 배지 |
| `consistency` | Purple | #8b5cf6 | 꾸준함 관련 배지 |

**선택 가이드**:
- 근력 운동 중심 → `strength`
- 유산소 운동 중심 → `cardio`
- 운동 횟수/빈도 → `effort`
- 특정 시간대 → `time`
- 연속성/습관 → `consistency`

---

## 📝 Step 3: 테스트 및 빌드

### 빌드 테스트

```bash
npm run build
```

**확인 사항**:
- ✅ TypeScript 에러 없음
- ✅ 빌드 성공

### 실행 테스트

```bash
npm run dev
```

**확인 사항**:
1. 클럽 대시보드 접속
2. Hall of Fame 위젯 확인
3. 새 배지가 표시되는지 확인
4. Me 카드가 맨 앞에 오는지 확인

---

## 🔍 디버깅 팁

### 배지가 안 나올 때

```typescript
// Helper 함수에 콘솔 로그 추가
const findWeekendWarrior = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  console.log('[WeekendWarrior] 로그 수:', logs.length);

  const userWeekendCounts = new Map();

  logs.forEach((log) => {
    const dayOfWeek = new Date(log.createdAt).getDay();
    console.log('[WeekendWarrior] 요일:', dayOfWeek, log.userDisplayName);
    // ...
  });

  console.log('[WeekendWarrior] 집계 결과:', Array.from(userWeekendCounts.entries()));
  // ...
};
```

### 주간 데이터가 부족할 때

```typescript
// 테스트용으로 기간 확장
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // 7 → 30일로 변경
const weeklyLogs = members.filter((log) => new Date(log.createdAt) >= thirtyDaysAgo);
```

---

## 💡 배지 아이디어 모음

### 1. 평일 전사
- **조건**: 평일(월-금) 운동 횟수 1위
- **type**: `effort`
- **icon**: 💼

### 2. 점심 시간 파이터
- **조건**: 12-14시 운동 횟수 1위
- **type**: `time`
- **icon**: 🍱

### 3. 철인
- **조건**: 7일 연속 출석
- **type**: `consistency`
- **icon**: 🛡️

### 4. 마라토너
- **조건**: 총 거리 42.195km 이상 달성
- **type**: `cardio`
- **icon**: 🏅

### 5. 파워리프터
- **조건**: 단일 세트 최대 무게
- **type**: `strength`
- **icon**: ⚡

### 6. 다재다능
- **조건**: 5가지 이상 카테고리 운동
- **type**: `effort`
- **icon**: 🎨

### 7. 스피드스터
- **조건**: 가장 빠른 페이스(min/km)
- **type**: `cardio`
- **icon**: 💨

### 8. 근성왕
- **조건**: 가장 긴 운동 시간 (단일 세션)
- **type**: `consistency`
- **icon**: 💪

---

## 📊 복잡한 조건 예시

### 예시 1: 복합 조건 (AND)

"새벽 + 주말" 배지:

```typescript
const findEarlyWeekend = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userCounts = new Map();

  logs.forEach((log) => {
    const hour = new Date(log.createdAt).getHours();
    const dayOfWeek = new Date(log.createdAt).getDay();

    // 새벽(4-8시) AND 주말(토요일 또는 일요일)
    if ((hour >= 4 && hour < 8) && (dayOfWeek === 0 || dayOfWeek === 6)) {
      // 집계 로직
    }
  });
  // ...
};
```

### 예시 2: 최댓값 찾기

"가장 무거운 세트" 배지:

```typescript
const findHeaviestLift = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  let heaviest = { userId: '', userName: '', userProfile: null, weight: 0 };

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    log.workouts.forEach((workout) => {
      if (workout.type === 'strength' && workout.weight_kg) {
        if (workout.weight_kg > heaviest.weight) {
          heaviest = {
            userId: log.userId!,
            userName: log.userDisplayName!,
            userProfile: log.userProfileImage || null,
            weight: workout.weight_kg,
          };
        }
      }
    });
  });

  if (heaviest.weight === 0) return null;

  return {
    userId: heaviest.userId,
    userName: heaviest.userName,
    userProfile: heaviest.userProfile,
    type: 'strength',
    title: '원펀맨',
    icon: '👊',
    description: `최대 ${heaviest.weight}kg 리프팅`,
    value: `${heaviest.weight}kg`,
    isMe: heaviest.userId === currentUserId,
    badgeId: `${heaviest.userId}-heaviest`,
  };
};
```

### 예시 3: 카테고리별 집계

"종목 마스터" 배지 (가장 많은 카테고리 운동):

```typescript
const findCategoryMaster = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userCategories = new Map<string, {
    userName: string;
    userProfile: string | null;
    categories: Set<string>
  }>();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userCategories.get(log.userId) || {
      userName: log.userDisplayName,
      userProfile: log.userProfileImage || null,
      categories: new Set<string>(),
    };

    log.workouts.forEach((workout) => {
      existing.categories.add(workout.category);
    });

    userCategories.set(log.userId, existing);
  });

  const rankings = Array.from(userCategories.entries())
    .filter(([_, data]) => data.categories.size > 0)
    .sort((a, b) => b[1].categories.size - a[1].categories.size);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'effort',
    title: '종목 마스터',
    icon: '🎯',
    description: `${data.categories.size}가지 종목 정복`,
    value: `${data.categories.size}종목`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-categorymaster`,
  };
};
```

---

## ✅ 체크리스트

배지 추가 시 다음 항목을 확인하세요:

- [ ] Helper 함수 작성 (`find[BadgeName]`)
- [ ] `calculateHofBadges()`에 추가
- [ ] 적절한 `type` 선택 (색상 매핑)
- [ ] 고유한 `badgeId` 생성
- [ ] `isMe` 플래그 설정
- [ ] 값이 0인 경우 `null` 반환
- [ ] TypeScript 타입 에러 없음
- [ ] 빌드 성공 (`npm run build`)
- [ ] 실제 테스트 (dev 환경)

---

## 🚨 주의사항

### 1. 고유 badgeId 사용

```typescript
// ❌ 잘못된 예
badgeId: `${userId}-workaholic` // 기존 배지와 중복 가능

// ✅ 올바른 예
badgeId: `${userId}-weekendwarrior` // 고유한 ID
```

### 2. null 체크

```typescript
// ❌ 값이 0이어도 배지 반환
if (rankings.length === 0) return null;
const [userId, data] = rankings[0];
return { ... }; // data.count가 0일 수 있음!

// ✅ 값이 0이면 배지 반환 안 함
const rankings = Array.from(userStats.entries())
  .filter(([_, data]) => data.count > 0) // 0 제외
  .sort(...);
```

### 3. 주간 데이터 필터링

```typescript
// calculateHofBadges()에서 이미 필터링됨
const weeklyLogs = members.filter(log => ...);

// Helper 함수에서는 weeklyLogs를 그대로 사용
const findMyBadge = (logs: WorkoutLog[], ...) => {
  // logs는 이미 주간 데이터임!
};
```

---

## 📚 관련 문서

- [Hall of Fame Carousel 구현](../features/hall_of_fame_carousel.md)
- [클럽 대시보드 위젯 시스템](../features/club_dashboard_widgets.md)
- [데이터 구조 문서](../features/club_dashboard_data_structure.md)

---

## 🤝 기여 가이드

새로운 배지를 추가했다면:

1. 이 가이드 문서의 "배지 아이디어 모음"에 추가
2. 구현 예시 작성
3. Pull Request 생성

---

**Last Updated**: 2026-01-21
**Difficulty**: ⭐⭐ (Intermediate)
