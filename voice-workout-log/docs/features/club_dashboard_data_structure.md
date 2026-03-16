# 클럽 대시보드 데이터 구조 및 취합 방식

## 📊 현재 구현 상태 (2026-01-20)

클럽 대시보드는 **Zero-Copy View 아키텍처**를 기반으로 구현되었습니다.
멤버들의 `workout_logs` 테이블을 RLS 정책으로 직접 조회하여 실시간 통계를 생성합니다.

---

## 1. 데이터 소스

### 함수: `getClubMemberLogs(clubId: string)`
**위치:** `src/storage/clubStorage.ts`

**쿼리 로직:**
```typescript
// 1단계: 클럽 멤버 user_id 조회
SELECT user_id FROM club_members WHERE club_id = clubId

// 2단계: 멤버들의 공개 운동 로그 조회
SELECT
  id, user_id, date, raw_text, normalized_text, memo, is_private,
  workouts (
    id, name, category, type, target,
    sets, reps, weight_kg, duration_min, distance_km, pace,
    speed_kph, incline_percent, resistance_level,
    adjusted_dist_km, volume_kg, run_count, note
  ),
  users (display_name, profile_image)
FROM workout_logs
WHERE user_id IN (memberUserIds)
  AND is_private = false
ORDER BY created_at DESC
```

**반환 데이터 구조:**
```typescript
WorkoutLog[] = [
  {
    id: string;
    userId: string;
    userDisplayName: string;
    userProfileImage: string | null;
    date: string;  // YYYY-MM-DD
    rawText: string;
    normalizedText: string;
    memo: string | null;
    createdAt: number;
    isPrivate: boolean;
    workouts: Workout[];  // 각 로그에 여러 운동 포함
  }
]
```

---

## 2. 클럽 통계 (ClubStats 컴포넌트)

### 📈 현재 표시 지표

| 지표 | 계산 방식 | 데이터 타입 |
|------|----------|-----------|
| **총 운동 수** | `members.reduce((sum, log) => sum + log.workouts.length, 0)` | `number` |
| **활성 멤버** | `new Set(members.map(log => log.userId)).size` | `number` |
| **이번 주 운동** | 최근 7일 로그의 운동 수 합계 | `number` |
| **총 기록** | `members.length` (로그 세션 수) | `number` |

### 📊 코드 구현
```typescript
const ClubStats = ({ members }: { members: WorkoutLog[] }) => {
  // 총 운동 수 (모든 로그의 workouts 배열 합산)
  const totalWorkouts = members.reduce((sum, log) => sum + log.workouts.length, 0);

  // 활성 멤버 (중복 제거)
  const activeMembers = new Set(members.map((log) => log.userId)).size;

  // 총 기록 (세션 수)
  const totalLogs = members.length;

  // 최근 7일 활동
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentLogs = members.filter((log) => new Date(log.createdAt) >= sevenDaysAgo);
  const weeklyWorkouts = recentLogs.reduce((sum, log) => sum + log.workouts.length, 0);

  return (
    <div className="stats-grid">
      <StatCard label="총 운동 수" value={totalWorkouts} />
      <StatCard label="활성 멤버" value={activeMembers + "명"} />
      <StatCard label="이번 주" value={weeklyWorkouts + " 운동"} />
      <StatCard label="총 기록" value={totalLogs} />
    </div>
  );
};
```

---

## 3. 리더보드 (LeaderboardSection 컴포넌트)

### 🏆 Type별 독립 리그

클럽 대시보드는 **3개의 독립 리더보드**를 운영합니다:

#### 3.1 🏃 유산소 킹 (Cardio Leaderboard)
- **지표:** `adjusted_dist_km` (평지 환산 거리)
- **계산 공식:** `거리(km) + (거리(km) × 인클라인(%) × 0.1)`
- **필터:** `workout.type === 'cardio'`

#### 3.2 🏋️ 스트렝스 킹 (Strength Leaderboard)
- **지표:** `volume_kg` (총 볼륨)
- **계산 공식:** `무게(kg) × 세트 × 횟수`
- **필터:** `workout.type === 'strength'`

#### 3.3 🏂 슬로프 킹 (Snowboard/Skill Leaderboard)
- **지표:** `run_count` (런 수)
- **계산 공식:** `reps` (시도 횟수)
- **필터:** `workout.category === 'snowboard'`

### 📊 리더보드 집계 로직

```typescript
const LeaderboardSection = ({ members, metricType }) => {
  // 1. 사용자별 집계 Map 생성
  const userMetrics = new Map<string, UserMetric>();

  // 2. 모든 로그를 순회하며 집계
  members.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existingMetric = userMetrics.get(log.userId) || {
      userId: log.userId,
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      value: 0,
    };

    // 3. 각 운동의 Type별 지표 합산
    log.workouts.forEach((workout) => {
      let value = 0;

      switch (metricType) {
        case 'cardio':
          if (workout.type === 'cardio' && workout.adjusted_dist_km) {
            value = workout.adjusted_dist_km;
          }
          break;
        case 'strength':
          if (workout.type === 'strength' && workout.volume_kg) {
            value = workout.volume_kg;
          }
          break;
        case 'snowboard':
          if (workout.category === 'snowboard' && workout.run_count) {
            value = workout.run_count;
          }
          break;
      }

      existingMetric.value += value;
    });

    userMetrics.set(log.userId, existingMetric);
  });

  // 4. 정렬 및 상위 10명 추출
  const rankings = Array.from(userMetrics.values())
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return rankings;
};
```

### 🎨 순위 표시
- 🥇 1위: 금색 (`#FFD700`)
- 🥈 2위: 은색 (`#C0C0C0`)
- 🥉 3위: 동색 (`#CD7F32`)
- 4-10위: 기본 색상

---

## 4. 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────┐
│                   ClubDetailPage                            │
│                                                             │
│  useEffect(() => {                                          │
│    if (tab === 'dashboard') {                               │
│      const logs = await getClubMemberLogs(clubId);  ────┐  │
│      setMemberLogs(logs);                                 │  │
│    }                                                      │  │
│  }, [tab, clubId]);                                       │  │
└───────────────────────────────────────────────────────────│──┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  getClubMemberLogs()                        │
│                                                             │
│  1. SELECT club_members WHERE club_id = X                  │
│  2. SELECT workout_logs                                     │
│       WHERE user_id IN (members)                            │
│       AND is_private = false                                │
│  3. JOIN workouts, users                                    │
└─────────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────┐
│              WorkoutLog[] (memberLogs)                      │
│                                                             │
│  [                                                          │
│    {                                                        │
│      userId: "user-123",                                    │
│      userDisplayName: "김민수",                             │
│      workouts: [                                            │
│        {                                                    │
│          name: "트레드밀",                                   │
│          type: "cardio",                                    │
│          adjusted_dist_km: 10.5,  ← 인클라인 보정 완료      │
│        },                                                   │
│        {                                                    │
│          name: "스쿼트",                                     │
│          type: "strength",                                  │
│          volume_kg: 2400,  ← 무게*세트*횟수 계산 완료       │
│        }                                                    │
│      ]                                                      │
│    },                                                       │
│    ...                                                      │
│  ]                                                          │
└─────────────────────────────────────────────────────────────┘
                    │                        │
                    ▼                        ▼
        ┌─────────────────────┐  ┌─────────────────────┐
        │   ClubStats         │  │  LeaderboardSection │
        │                     │  │                     │
        │ - 총 운동 수         │  │ - 유산소 킹 🏃       │
        │ - 활성 멤버          │  │ - 스트렝스 킹 🏋️    │
        │ - 이번 주 운동       │  │ - 슬로프 킹 🏂      │
        │ - 총 기록           │  │                     │
        └─────────────────────┘  └─────────────────────┘
```

---

## 5. 성능 최적화

### 5.1 Zero-Copy 아키텍처
- ✅ 데이터 중복 저장 없음 (club_feeds 테이블 미사용)
- ✅ Single Source of Truth (workout_logs)
- ✅ RLS로 보안 보장

### 5.2 인덱스 활용
```sql
-- 리더보드 쿼리 성능 향상
CREATE INDEX idx_workouts_adjusted_dist ON workouts(adjusted_dist_km);
CREATE INDEX idx_workouts_volume ON workouts(volume_kg);
CREATE INDEX idx_workouts_run_count ON workouts(run_count);
```

### 5.3 클라이언트 사이드 집계
- 서버에서 원본 데이터 전송
- 브라우저에서 실시간 집계 (Map 자료구조 활용)
- 불필요한 DB 쿼리 최소화

---

## 6. 확장 가능성

### 6.1 추가 가능한 통계 지표
- [ ] 평균 운동 강도 (난이도 평균)
- [ ] 연속 운동 일수 (Streak)
- [ ] 주간 활동 그래프
- [ ] Type별 분포도 (파이 차트)
- [ ] 시간대별 활동 히트맵
- [ ] 멤버별 성장 추이
- [ ] 클럽 전체 목표 달성률

### 6.2 추가 가능한 리더보드
- [ ] 🎯 연속 출석왕 (Streak King)
- [ ] 💎 올라운더 (모든 Type 골고루)
- [ ] ⚡ 강도왕 (난이도 평균)
- [ ] 📅 주말 전사 (주말 활동)
- [ ] 🌅 새벽 부대 (오전 6시 전 운동)

### 6.3 게이미피케이션 요소
- [ ] 뱃지 시스템 (첫 100km, 볼륨 10톤 등)
- [ ] 레벨 시스템 (클럽 경험치)
- [ ] 도전 과제 (Achievement)
- [ ] 타이틀 획득 (월간 킹 유지 시)

---

## 7. 데이터 예시

### 입력 데이터 (getClubMemberLogs 반환값)
```json
[
  {
    "id": "log-001",
    "userId": "user-123",
    "userDisplayName": "김민수",
    "userProfileImage": "https://...",
    "date": "2026-01-20",
    "createdAt": 1737350400000,
    "workouts": [
      {
        "name": "트레드밀",
        "category": "gym",
        "type": "cardio",
        "distance_km": 5.0,
        "incline_percent": 10,
        "adjusted_dist_km": 10.0,
        "duration_min": 30
      },
      {
        "name": "스쿼트",
        "category": "gym",
        "type": "strength",
        "target": "lower",
        "weight_kg": 100,
        "sets": 5,
        "reps": 5,
        "volume_kg": 2500
      }
    ]
  }
]
```

### 출력 데이터 (리더보드)
```json
{
  "cardio": [
    { "userId": "user-123", "displayName": "김민수", "value": 45.5 },
    { "userId": "user-456", "displayName": "이영희", "value": 38.2 }
  ],
  "strength": [
    { "userId": "user-123", "displayName": "김민수", "value": 12500 },
    { "userId": "user-789", "displayName": "박철수", "value": 8000 }
  ],
  "snowboard": [
    { "userId": "user-999", "displayName": "최보더", "value": 25 }
  ]
}
```

---

## 8. 개선 아이디어 브레인스토밍 가이드

현재 구조에서 개선할 수 있는 방향:

1. **재미 요소 추가**
   - 현재: 단순 숫자 나열
   - 개선: 스토리텔링, 비유, 이모지 활용

2. **비교 가능성**
   - 현재: 절대값만 표시
   - 개선: 지난주 대비, 클럽 평균 대비

3. **시각화**
   - 현재: 텍스트 중심
   - 개선: 차트, 그래프, 프로그레스 바

4. **개인화**
   - 현재: 전체 통계만
   - 개선: "내 순위", "내 기여도" 표시

5. **소셜 기능**
   - 현재: 조용한 리더보드
   - 개선: 응원, 댓글, 반응

---

## 9. 기술 스택

- **프론트엔드:** React + TypeScript
- **상태 관리:** useState (로컬)
- **데이터 페칭:** Supabase JS SDK
- **스타일링:** Inline Styles + CSS Classes
- **계산 로직:** `src/utils/calculateMetrics.ts`

---

**문서 작성일:** 2026-01-20
**작성자:** Claude Code
**버전:** 1.0.0
