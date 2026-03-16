import type { Workout } from '../types';

/**
 * Type별 전용 지표 계산 유틸리티
 *
 * 철학: "사과는 사과끼리, 오렌지는 오렌지끼리"
 * - 카디오는 카디오끼리 비교 (adjusted_dist_km)
 * - 근력은 근력끼리 비교 (volume_kg)
 * - 스킬은 스킬끼리 비교 (run_count)
 */

/**
 * 모든 Type별 지표를 한번에 계산
 */
export const calculateAllMetrics = (workout: Workout): {
  adjusted_dist_km: number | null;
  volume_kg: number | null;
  run_count: number | null;
} => {
  return {
    adjusted_dist_km: calculateAdjustedDistance(workout),
    volume_kg: calculateVolume(workout),
    run_count: calculateRunCount(workout),
  };
};

/**
 * 🏃 카디오: 평지 환산 거리 (Flat Equivalent Distance)
 *
 * 공식: Distance + (Distance × Incline% × 0.1)
 *
 * 논리:
 * - 경사도 1%당 약 10%의 부하가 더 걸린다고 가정
 * - GAP (Grade Adjusted Pace) 모델의 간소화 버전
 *
 * 예시:
 * - 평지 5km → 5.0 km
 * - 인클라인 10% 5km → 5 + (5 * 10 * 0.1) = 10.0 km
 * - 인클라인 15% 2.5km → 2.5 + (2.5 * 15 * 0.1) = 6.25 km
 *
 * 거리가 없고 시간만 있을 경우:
 * - duration_min * 0.167 (시간당 10km 기준)
 */
export const calculateAdjustedDistance = (workout: Workout): number | null => {
  if (workout.type !== 'cardio') return null;

  const { distance_km, duration_min, incline_percent, resistance_level } = workout;

  // 거리 기반 계산
  if (distance_km) {
    let adjusted = distance_km;

    // 인클라인 보정
    if (incline_percent) {
      adjusted += distance_km * incline_percent * 0.1;
    }

    // 저항 레벨 보정 (사이클, 로잉)
    // 레벨당 5% 추가 부하 인정
    if (resistance_level) {
      adjusted *= 1 + resistance_level * 0.05;
    }

    return Number(adjusted.toFixed(2));
  }

  // 시간 기반 대략적 환산 (거리가 없을 때)
  if (duration_min) {
    // 1시간 = 10km 기준 (6분/km 페이스)
    let adjusted = (duration_min / 60) * 10;

    // 저항 레벨 보정
    if (resistance_level) {
      adjusted *= 1 + resistance_level * 0.05;
    }

    return Number(adjusted.toFixed(2));
  }

  return null;
};

/**
 * 🏋️ 근력: 총 볼륨 (Total Volume)
 *
 * 공식: Weight(kg) × Reps × Sets
 *
 * 가장 정직한 지표. 들어 올린 총 무게.
 *
 * 예시:
 * - 벤치프레스 80kg × 10회 × 3세트 = 2,400 kg
 * - 스쿼트 100kg × 5회 × 5세트 = 2,500 kg
 */
export const calculateVolume = (workout: Workout): number | null => {
  if (workout.type !== 'strength') return null;

  const { weight_kg, sets, reps } = workout;

  if (!weight_kg || !sets || !reps) return null;

  const volume = weight_kg * sets * reps;
  return Number(volume.toFixed(1));
};

/**
 * 🏂 스킬/스노보드: 런 수 / 시도 횟수
 *
 * reps 값을 그대로 사용
 *
 * 예시:
 * - 스노보드 25 Runs → 25
 * - 골프 스윙 연습 100회 → 100
 * - 트릭 10회 성공 → 10
 */
export const calculateRunCount = (workout: Workout): number | null => {
  if (workout.type !== 'skill' && workout.category !== 'snowboard') return null;

  return workout.reps || null;
};

/**
 * Workout 배열의 Type별 총합 계산
 */
export const calculateTotalMetrics = (workouts: Workout[]): {
  totalAdjustedDistance: number;
  totalVolume: number;
  totalRunCount: number;
} => {
  let totalAdjustedDistance = 0;
  let totalVolume = 0;
  let totalRunCount = 0;

  workouts.forEach((workout) => {
    const adjustedDist = calculateAdjustedDistance(workout);
    const volume = calculateVolume(workout);
    const runCount = calculateRunCount(workout);

    if (adjustedDist) totalAdjustedDistance += adjustedDist;
    if (volume) totalVolume += volume;
    if (runCount) totalRunCount += runCount;
  });

  return {
    totalAdjustedDistance: Number(totalAdjustedDistance.toFixed(2)),
    totalVolume: Number(totalVolume.toFixed(1)),
    totalRunCount,
  };
};

/**
 * 리더보드용 포맷팅
 */
export const formatMetric = (value: number, type: 'distance' | 'volume' | 'count'): string => {
  switch (type) {
    case 'distance':
      return `${value.toFixed(1)} km`;
    case 'volume':
      // 1000 이상은 톤(t) 단위로
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)} t`;
      }
      return `${value.toFixed(0)} kg`;
    case 'count':
      return `${value} 회`;
    default:
      return String(value);
  }
};

/**
 * Type별 운동만 필터링
 */
export const filterWorkoutsByType = (
  workouts: Workout[],
  type: 'strength' | 'cardio' | 'skill' | 'flexibility'
): Workout[] => {
  return workouts.filter((w) => w.type === type);
};

/**
 * Category별 운동만 필터링
 */
export const filterWorkoutsByCategory = (
  workouts: Workout[],
  category: string
): Workout[] => {
  return workouts.filter((w) => w.category === category);
};
