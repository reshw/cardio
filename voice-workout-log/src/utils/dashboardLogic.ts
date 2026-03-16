import type { WorkoutLog, WorkoutCategory } from '../types';

/**
 * 클럽 대시보드 계산 로직
 * MMORPG 길드 로비 스타일의 게이밍 UI를 위한 유틸리티
 */

// ============================================
// 타이틀 시스템
// ============================================

export interface MemberTitle {
  userId: string;
  displayName: string;
  profileImage: string | null;
  title: string;
  icon: string;
  value: number | string;
  description: string;
}

// ============================================
// Hall of Fame Badge System (New)
// ============================================

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

/**
 * 타이틀 부여 로직 (Legacy)
 * @deprecated Use calculateHofBadges instead for carousel UI
 */
export const calculateTitles = (members: WorkoutLog[]): MemberTitle[] => {
  const titles: MemberTitle[] = [];

  // 🌅 새벽 트레이너 (04:00-07:00 최초 운동)
  const earlyBird = findEarlyBird(members);
  if (earlyBird) titles.push(earlyBird);

  // 🏋️ 볼륨 킹 (총 볼륨 1위)
  const volumeKing = findVolumeKing(members);
  if (volumeKing) titles.push(volumeKing);

  // 🏃 거리 킹 (총 거리 1위)
  const distanceKing = findDistanceKing(members);
  if (distanceKing) titles.push(distanceKing);

  // 🏂 런 킹 (총 런 수 1위)
  const runKing = findRunKing(members);
  if (runKing) titles.push(runKing);

  // ⚡ 연속 출석 (주간 운동 횟수 최다)
  const streakKing = findStreakKing(members);
  if (streakKing) titles.push(streakKing);

  return titles;
};

/**
 * Hall of Fame Badge Calculation (New Carousel System)
 *
 * 6가지 배지를 계산하여 반환합니다:
 * - Workaholic: 총 운동 횟수 1위
 * - EarlyBird: 04-08시 운동 횟수 1위
 * - NightOwl: 22-03시 운동 횟수 1위
 * - VolumeKing: 총 볼륨(kg) 1위
 * - CardioKing: 환산 거리(km) 1위
 * - SlopeMaster: 스노보드 런 수 1위
 *
 * @param members - 클럽 멤버들의 운동 로그
 * @param currentUserId - 현재 로그인한 유저 ID (Me-first sorting용)
 */
export const calculateHofBadges = (
  members: WorkoutLog[],
  currentUserId?: string
): HofBadge[] => {
  // 주간 데이터 필터링 (최근 30일) - 테스트용으로 확장
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const weeklyLogs = members.filter((log) => new Date(log.createdAt) >= thirtyDaysAgo);

  console.log('[calculateHofBadges] 전체 로그:', members.length);
  console.log('[calculateHofBadges] 30일 이내 로그:', weeklyLogs.length);

  const badges: HofBadge[] = [];

  // 1. Workaholic: 총 운동 횟수 1위
  const workaholic = findWorkaholic(weeklyLogs, currentUserId);
  if (workaholic) badges.push(workaholic);

  // 2. EarlyBird: 04-08시 운동 횟수 1위
  const earlyBird = findEarlyBirdBadge(weeklyLogs, currentUserId);
  if (earlyBird) badges.push(earlyBird);

  // 3. NightOwl: 22-03시 운동 횟수 1위
  const nightOwl = findNightOwl(weeklyLogs, currentUserId);
  if (nightOwl) badges.push(nightOwl);

  // 4. VolumeKing: 총 볼륨(kg) 1위
  const volumeKing = findVolumeKingBadge(weeklyLogs, currentUserId);
  if (volumeKing) badges.push(volumeKing);

  // 5. CardioKing: 환산 거리(km) 1위
  const cardioKing = findCardioKing(weeklyLogs, currentUserId);
  if (cardioKing) badges.push(cardioKing);

  // 6. SlopeMaster: 스노보드 런 수 1위
  const slopeMaster = findSlopeMaster(weeklyLogs, currentUserId);
  if (slopeMaster) badges.push(slopeMaster);

  // Me-first sorting: isMe가 true인 배지를 맨 앞으로
  return badges.sort((a, b) => {
    if (a.isMe && !b.isMe) return -1;
    if (!a.isMe && b.isMe) return 1;
    return 0; // 나머지는 순서 유지 (랜덤은 UI에서 처리)
  });
};

// Helper: Workaholic (총 운동 횟수 1위)
const findWorkaholic = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userWorkoutCounts = new Map<
    string,
    { userName: string; userProfile: string | null; count: number }
  >();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userWorkoutCounts.get(log.userId) || {
      userName: log.userDisplayName,
      userProfile: log.userProfileImage || null,
      count: 0,
    };

    existing.count += log.workouts.length;
    userWorkoutCounts.set(log.userId, existing);
  });

  const rankings = Array.from(userWorkoutCounts.entries())
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'effort',
    title: '워커홀릭',
    icon: '🔥',
    description: `주간 ${data.count}회 운동`,
    value: `${data.count}회`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-workaholic`,
  };
};

// Helper: EarlyBird (04-08시 운동 횟수 1위)
const findEarlyBirdBadge = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userEarlyCounts = new Map<
    string,
    { userName: string; userProfile: string | null; count: number }
  >();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const hour = new Date(log.createdAt).getHours();
    if (hour >= 4 && hour < 8) {
      const existing = userEarlyCounts.get(log.userId) || {
        userName: log.userDisplayName,
        userProfile: log.userProfileImage || null,
        count: 0,
      };

      existing.count += 1;
      userEarlyCounts.set(log.userId, existing);
    }
  });

  const rankings = Array.from(userEarlyCounts.entries())
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'time',
    title: '미라클 모닝',
    icon: '🌅',
    description: `새벽 ${data.count}회 운동`,
    value: `${data.count}회`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-earlybird`,
  };
};

// Helper: NightOwl (22-03시 운동 횟수 1위)
const findNightOwl = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userNightCounts = new Map<
    string,
    { userName: string; userProfile: string | null; count: number }
  >();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const hour = new Date(log.createdAt).getHours();
    if (hour >= 22 || hour < 3) {
      const existing = userNightCounts.get(log.userId) || {
        userName: log.userDisplayName,
        userProfile: log.userProfileImage || null,
        count: 0,
      };

      existing.count += 1;
      userNightCounts.set(log.userId, existing);
    }
  });

  const rankings = Array.from(userNightCounts.entries())
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'time',
    title: '올빼미 파수꾼',
    icon: '🦉',
    description: `심야 ${data.count}회 운동`,
    value: `${data.count}회`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-nightowl`,
  };
};

// Helper: VolumeKing (총 볼륨 1위)
const findVolumeKingBadge = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  console.log('[VolumeKing] 로그 수:', logs.length);
  console.log('[VolumeKing] 첫 번째 로그 샘플:', logs[0]);

  const userVolumes = new Map<
    string,
    { userName: string; userProfile: string | null; volume: number }
  >();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userVolumes.get(log.userId) || {
      userName: log.userDisplayName,
      userProfile: log.userProfileImage || null,
      volume: 0,
    };

    log.workouts.forEach((workout) => {
      // volume_kg가 없으면 즉석에서 계산 (기존 데이터 대응)
      let calculatedVolume = workout.volume_kg;
      if (!calculatedVolume && workout.sets && workout.reps && workout.weight_kg) {
        calculatedVolume = workout.sets * workout.reps * workout.weight_kg;
      }

      console.log('[VolumeKing] Workout:', {
        name: workout.name,
        type: workout.type,
        category: workout.category,
        volume_kg: workout.volume_kg,
        calculatedVolume,
        sets: workout.sets,
        reps: workout.reps,
        weight_kg: workout.weight_kg,
      });

      // type이 'strength'이거나 category가 'gym', 'home'이고 볼륨이 있으면 집계
      const isStrengthWorkout = workout.type === 'strength' ||
                                ['gym', 'home'].includes(workout.category);

      if (isStrengthWorkout && calculatedVolume) {
        existing.volume += calculatedVolume;
        console.log('[VolumeKing] 볼륨 추가:', calculatedVolume, '누적:', existing.volume);
      }
    });

    userVolumes.set(log.userId, existing);
  });

  console.log('[VolumeKing] 유저별 볼륨:', Array.from(userVolumes.entries()));

  const rankings = Array.from(userVolumes.entries())
    .filter(([_, data]) => data.volume > 0)
    .sort((a, b) => b[1].volume - a[1].volume);

  console.log('[VolumeKing] 순위:', rankings);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];
  const volumeInTons = (data.volume / 1000).toFixed(1);

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'strength',
    title: '3대 500 꿈나무',
    icon: '🏋️',
    description: `총 볼륨 ${volumeInTons}톤`,
    value: `${volumeInTons}t`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-volumeking`,
  };
};

// Helper: CardioKing (환산 거리 1위)
const findCardioKing = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userDistances = new Map<
    string,
    { userName: string; userProfile: string | null; distance: number }
  >();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userDistances.get(log.userId) || {
      userName: log.userDisplayName,
      userProfile: log.userProfileImage || null,
      distance: 0,
    };

    log.workouts.forEach((workout) => {
      // type이 'cardio'이거나 category가 'running'이고 거리가 있으면 집계
      const isCardioWorkout = workout.type === 'cardio' ||
                              (workout.category === 'running' && workout.adjusted_dist_km);

      if (isCardioWorkout && workout.adjusted_dist_km) {
        existing.distance += workout.adjusted_dist_km;
      }
    });

    userDistances.set(log.userId, existing);
  });

  const rankings = Array.from(userDistances.entries())
    .filter(([_, data]) => data.distance > 0)
    .sort((a, b) => b[1].distance - a[1].distance);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'cardio',
    title: '지칠 줄 모르는 심장',
    icon: '🏃',
    description: `총 거리 ${data.distance.toFixed(1)}km`,
    value: `${data.distance.toFixed(1)}km`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-cardioking`,
  };
};

// Helper: SlopeMaster (스노보드 런 수 1위)
const findSlopeMaster = (logs: WorkoutLog[], currentUserId?: string): HofBadge | null => {
  const userRuns = new Map<
    string,
    { userName: string; userProfile: string | null; runs: number }
  >();

  logs.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userRuns.get(log.userId) || {
      userName: log.userDisplayName,
      userProfile: log.userProfileImage || null,
      runs: 0,
    };

    log.workouts.forEach((workout) => {
      if (workout.category === 'snowboard' && workout.run_count) {
        existing.runs += workout.run_count;
      }
    });

    userRuns.set(log.userId, existing);
  });

  const rankings = Array.from(userRuns.entries())
    .filter(([_, data]) => data.runs > 0)
    .sort((a, b) => b[1].runs - a[1].runs);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    userName: data.userName,
    userProfile: data.userProfile,
    type: 'consistency',
    title: '설원의 지배자',
    icon: '🏂',
    description: `총 ${data.runs}런 완주`,
    value: `${data.runs}런`,
    isMe: userId === currentUserId,
    badgeId: `${userId}-slopemaster`,
  };
};

const findEarlyBird = (members: WorkoutLog[]): MemberTitle | null => {
  const today = new Date().toISOString().split('T')[0];

  let earliest: { userId: string; displayName: string; profileImage: string | null; time: number } | null = null;

  members.forEach((log) => {
    if (log.date !== today) return;
    if (!log.userId || !log.userDisplayName) return;

    const createdTime = new Date(log.createdAt);
    const hour = createdTime.getHours();

    if (hour >= 4 && hour < 7) {
      if (!earliest || createdTime.getTime() < earliest.time) {
        earliest = {
          userId: log.userId,
          displayName: log.userDisplayName,
          profileImage: log.userProfileImage || null,
          time: createdTime.getTime(),
        };
      }
    }
  });

  if (!earliest) return null;

  const { userId, displayName, profileImage, time: timestamp } = earliest;
  const time = new Date(timestamp);
  return {
    userId,
    displayName,
    profileImage,
    title: '새벽 트레이너',
    icon: '🌅',
    value: `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`,
    description: '오늘 가장 먼저 운동 시작',
  };
};

const findVolumeKing = (members: WorkoutLog[]): MemberTitle | null => {
  const userVolumes = new Map<string, { displayName: string; profileImage: string | null; volume: number }>();

  members.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userVolumes.get(log.userId) || {
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      volume: 0,
    };

    log.workouts.forEach((workout) => {
      if (workout.type === 'strength' && workout.volume_kg) {
        existing.volume += workout.volume_kg;
      }
    });

    userVolumes.set(log.userId, existing);
  });

  const rankings = Array.from(userVolumes.entries())
    .filter(([_, data]) => data.volume > 0)
    .sort((a, b) => b[1].volume - a[1].volume);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];
  const volumeInTons = data.volume / 1000;

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '볼륨 킹',
    icon: '🏋️',
    value: `${volumeInTons.toFixed(1)}t`,
    description: '총 볼륨 1위',
  };
};

const findDistanceKing = (members: WorkoutLog[]): MemberTitle | null => {
  const userDistances = new Map<string, { displayName: string; profileImage: string | null; distance: number }>();

  members.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userDistances.get(log.userId) || {
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      distance: 0,
    };

    log.workouts.forEach((workout) => {
      if (workout.type === 'cardio' && workout.adjusted_dist_km) {
        existing.distance += workout.adjusted_dist_km;
      }
    });

    userDistances.set(log.userId, existing);
  });

  const rankings = Array.from(userDistances.entries())
    .filter(([_, data]) => data.distance > 0)
    .sort((a, b) => b[1].distance - a[1].distance);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '거리 킹',
    icon: '🏃',
    value: `${data.distance.toFixed(1)}km`,
    description: '총 거리 1위',
  };
};

const findRunKing = (members: WorkoutLog[]): MemberTitle | null => {
  const userRuns = new Map<string, { displayName: string; profileImage: string | null; runs: number }>();

  members.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userRuns.get(log.userId) || {
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      runs: 0,
    };

    log.workouts.forEach((workout) => {
      if (workout.category === 'snowboard' && workout.run_count) {
        existing.runs += workout.run_count;
      }
    });

    userRuns.set(log.userId, existing);
  });

  const rankings = Array.from(userRuns.entries())
    .filter(([_, data]) => data.runs > 0)
    .sort((a, b) => b[1].runs - a[1].runs);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '런 킹',
    icon: '🏂',
    value: `${data.runs}회`,
    description: '총 런 수 1위',
  };
};

const findStreakKing = (members: WorkoutLog[]): MemberTitle | null => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const userFrequency = new Map<string, { displayName: string; profileImage: string | null; count: number }>();

  members.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;
    if (new Date(log.createdAt) < sevenDaysAgo) return;

    const existing = userFrequency.get(log.userId) || {
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      count: 0,
    };

    existing.count += 1;
    userFrequency.set(log.userId, existing);
  });

  const rankings = Array.from(userFrequency.entries())
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '연속 출석',
    icon: '⚡',
    value: `${data.count}일`,
    description: '주간 운동 횟수 최다',
  };
};

// ============================================
// 미션 시스템
// ============================================

export interface Mission {
  title: string;
  current: number;
  target: number;
  progress: number;
  unit: string;
  category: WorkoutCategory;
}

/**
 * 클럽 미션 계산
 * 클럽의 주요 카테고리에 따라 목표 자동 설정
 */
export const calculateMission = (members: WorkoutLog[], mainCategory: WorkoutCategory): Mission => {
  let current = 0;
  let target = 0;
  let unit = '';
  let title = '';

  switch (mainCategory) {
    case 'gym':
      // 총 볼륨 목표: 100톤
      members.forEach((log) => {
        log.workouts.forEach((workout) => {
          if (workout.type === 'strength' && workout.volume_kg) {
            current += workout.volume_kg;
          }
        });
      });
      target = 100000; // kg
      unit = 't';
      title = '볼륨 목표';
      current = current / 1000; // 톤으로 변환
      target = target / 1000;
      break;

    case 'running':
      // 총 거리 목표: 400km (서울-부산)
      members.forEach((log) => {
        log.workouts.forEach((workout) => {
          if (workout.type === 'cardio' && workout.adjusted_dist_km) {
            current += workout.adjusted_dist_km;
          }
        });
      });
      target = 400;
      unit = 'km';
      title = '거리 목표';
      break;

    case 'snowboard':
      // 총 런 목표: 8,848m (에베레스트 높이)
      members.forEach((log) => {
        log.workouts.forEach((workout) => {
          if (workout.category === 'snowboard' && workout.run_count) {
            current += workout.run_count;
          }
        });
      });
      target = 8848;
      unit = 'm';
      title = '고도 목표';
      break;

    default:
      // 기본: 총 운동 횟수
      members.forEach((log) => {
        current += log.workouts.length;
      });
      target = 1000;
      unit = '회';
      title = '운동 목표';
  }

  const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return {
    title,
    current: Number(current.toFixed(1)),
    target: Number(target.toFixed(1)),
    progress: Number(progress.toFixed(1)),
    unit,
    category: mainCategory,
  };
};

// ============================================
// 오늘의 출석부
// ============================================

export interface SquadMember {
  userId: string;
  displayName: string;
  profileImage: string | null;
  mainActivity: string; // 🏂, 🏋️, 🏃
  memo: string | null;
  workoutCount: number;
  activityType: 'today' | 'yesterday' | 'recent'; // Smart Squad: 활동 시점 구분
  lastActiveDate: string; // YYYY-MM-DD format
}

/**
 * 오늘 운동한 멤버 필터링 (Legacy)
 * @deprecated Use getSmartSquad instead
 */
export const getTodaySquad = (members: WorkoutLog[]): SquadMember[] => {
  const today = new Date().toISOString().split('T')[0];

  const squadMap = new Map<string, SquadMember>();

  members.forEach((log) => {
    if (log.date !== today) return;
    if (!log.userId || !log.userDisplayName) return;

    const existing = squadMap.get(log.userId) || {
      userId: log.userId,
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      mainActivity: '💪',
      memo: log.memo || null,
      workoutCount: 0,
      activityType: 'today' as const,
      lastActiveDate: today,
    };

    // 가장 비중이 높은 운동 타입 찾기
    const typeCounts = new Map<string, number>();
    log.workouts.forEach((workout) => {
      const icon = getActivityIcon(workout.category, workout.type);
      typeCounts.set(icon, (typeCounts.get(icon) || 0) + 1);
    });

    const maxIcon = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '💪';
    existing.mainActivity = maxIcon;
    existing.workoutCount += log.workouts.length;

    squadMap.set(log.userId, existing);
  });

  return Array.from(squadMap.values()).sort((a, b) => b.workoutCount - a.workoutCount);
};

/**
 * Smart Active Squad - 오늘 + 어제 운동한 멤버를 함께 표시
 *
 * 알고리즘:
 * 1. 오늘 운동한 멤버를 최상단에 배치 (activityType: 'today')
 * 2. 오늘 운동한 멤버가 4명 미만이면 어제 운동한 멤버 추가 (activityType: 'yesterday')
 * 3. 오늘+어제 모두 없으면 가장 최근 활동한 멤버 3명 표시 (activityType: 'recent')
 * 4. 중복 제거: 한 유저의 최신 기록만 표시
 */
export const getSmartSquad = (members: WorkoutLog[]): SquadMember[] => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 유저별 최신 활동 정보를 저장
  interface UserActivity {
    userId: string;
    displayName: string;
    profileImage: string | null;
    mainActivity: string;
    memo: string | null;
    workoutCount: number;
    activityType: 'today' | 'yesterday' | 'recent';
    lastActiveDate: string;
    lastActiveTimestamp: number;
  }

  const userActivityMap = new Map<string, UserActivity>();

  // 모든 로그를 순회하며 유저별 최신 활동 집계
  members.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existing = userActivityMap.get(log.userId);

    // 이미 등록된 유저라면, 더 최근 활동만 반영
    if (existing && log.createdAt <= existing.lastActiveTimestamp) {
      // 같은 날짜의 추가 운동이면 카운트만 증가
      if (log.date === existing.lastActiveDate) {
        existing.workoutCount += log.workouts.length;
      }
      return;
    }

    // 활동 타입 결정
    let activityType: 'today' | 'yesterday' | 'recent';
    if (log.date === todayStr) {
      activityType = 'today';
    } else if (log.date === yesterdayStr) {
      activityType = 'yesterday';
    } else {
      activityType = 'recent';
    }

    // 가장 비중이 높은 운동 타입 찾기
    const typeCounts = new Map<string, number>();
    log.workouts.forEach((workout) => {
      const icon = getActivityIcon(workout.category, workout.type);
      typeCounts.set(icon, (typeCounts.get(icon) || 0) + 1);
    });

    const maxIcon = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '💪';

    userActivityMap.set(log.userId, {
      userId: log.userId,
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      mainActivity: maxIcon,
      memo: log.memo || null,
      workoutCount: log.workouts.length,
      activityType,
      lastActiveDate: log.date,
      lastActiveTimestamp: log.createdAt,
    });
  });

  // 우선순위별로 정렬
  const allMembers = Array.from(userActivityMap.values());

  // 오늘 운동한 멤버
  const todayMembers = allMembers
    .filter((m) => m.activityType === 'today')
    .sort((a, b) => b.workoutCount - a.workoutCount);

  // 어제 운동한 멤버
  const yesterdayMembers = allMembers
    .filter((m) => m.activityType === 'yesterday')
    .sort((a, b) => b.workoutCount - a.workoutCount);

  // 최근 활동 멤버
  const recentMembers = allMembers
    .filter((m) => m.activityType === 'recent')
    .sort((a, b) => b.lastActiveTimestamp - a.lastActiveTimestamp)
    .slice(0, 3);

  // Smart Mix 로직
  const result: SquadMember[] = [];

  // 1. 오늘 운동한 멤버 추가
  result.push(...todayMembers);

  // 2. 오늘 멤버가 4명 미만이면 어제 멤버 추가
  if (result.length < 4) {
    result.push(...yesterdayMembers);
  }

  // 3. 오늘+어제 모두 없으면 최근 멤버 추가
  if (result.length === 0) {
    result.push(...recentMembers);
  }

  return result;
};

const getActivityIcon = (category: WorkoutCategory, type: string): string => {
  if (category === 'snowboard') return '🏂';
  if (type === 'cardio') return '🏃';
  if (type === 'strength') return '🏋️';
  if (type === 'skill') return '🎯';
  return '💪';
};

// ============================================
// Live Ticker
// ============================================

export interface TickerItem {
  id: string;
  icon: string;
  text: string;
  timestamp: number;
}

/**
 * 최신 활동 피드 생성
 */
export const generateTickerItems = (members: WorkoutLog[], limit: number = 10): TickerItem[] => {
  const items: TickerItem[] = [];

  // 최신순 정렬
  const sorted = [...members].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);

  sorted.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    // 대표 운동 선택 (가장 인상적인 것)
    const bestWorkout = log.workouts.reduce((best, current) => {
      const currentScore = getWorkoutScore(current);
      const bestScore = getWorkoutScore(best);
      return currentScore > bestScore ? current : best;
    }, log.workouts[0]);

    if (!bestWorkout) return;

    const icon = getActivityIcon(bestWorkout.category, bestWorkout.type);
    const text = formatTickerText(log.userDisplayName, bestWorkout);

    items.push({
      id: log.id,
      icon,
      text,
      timestamp: log.createdAt,
    });
  });

  return items;
};

const getWorkoutScore = (workout: any): number => {
  // 인상적인 운동일수록 높은 점수
  if (workout.volume_kg) return workout.volume_kg / 100;
  if (workout.adjusted_dist_km) return workout.adjusted_dist_km * 10;
  if (workout.run_count) return workout.run_count * 5;
  return 1;
};

const formatTickerText = (displayName: string, workout: any): string => {
  const name = workout.name;

  if (workout.volume_kg && workout.volume_kg > 1000) {
    const tons = (workout.volume_kg / 1000).toFixed(1);
    return `${displayName}님 ${name} ${tons}t 달성`;
  }

  if (workout.adjusted_dist_km && workout.adjusted_dist_km > 10) {
    return `${displayName}님 ${workout.adjusted_dist_km.toFixed(1)}km 완주`;
  }

  if (workout.run_count && workout.run_count > 20) {
    return `${displayName}님 ${workout.run_count}런 완료`;
  }

  return `${displayName}님 ${name} 완료`;
};
