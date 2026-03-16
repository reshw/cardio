/**
 * Cardio Normalization - 유산소 운동의 공정성을 위한 환산 비율 적용
 *
 * 📌 중요: 기록은 그대로 저장하고, 집계 시에만 비율 적용
 * - 원본 데이터는 수정하지 않음
 * - 빈 필드(거리, 속도 등)가 있으면 계산해서 채움
 * - 대시보드 집계 로직에서만 환산 비율(multiplier) 적용
 * - UI에서 아이콘으로 환산 비율 명시
 */

import type { Workout } from '../../types';

// 유산소 운동 표준 카테고리
export type CardioCategory = 'running' | 'stepmill' | 'rowing' | 'cycle' | 'other';

// 종목별 인정 비율 (Multiplier) - 집계 시에만 사용
export const CARDIO_MULTIPLIERS: Record<CardioCategory, number> = {
  running: 1.0,   // 100% - 러닝, 트레드밀
  stepmill: 1.0,  // 100% - 천국의계단, 스텝밀, 등산
  rowing: 0.6,    // 60%  - 로잉머신, 조정
  cycle: 0.4,     // 40%  - 사이클, 실내자전거, 스피닝
  other: 0.3,     // 30%  - 엘립티컬, 줄넘기, 수영, 기타
};

// 종목명 → 표준 카테고리 매핑 키워드
const CARDIO_KEYWORDS: Record<CardioCategory, string[]> = {
  running: [
    '러닝', '트레드밀', '달리기', '조깅', '마라톤', '야외러닝',
    '런닝', '뛰기', 'running', 'treadmill', 'jogging'
  ],
  stepmill: [
    '천국의계단', '스텝밀', '마이마운틴', '등산', '스테퍼',
    '계단', '스텝머신', 'stepmill', 'stairmaster', 'stepper'
  ],
  rowing: [
    '로잉', '로잉머신', '조정', '노젓기', 'rowing', 'rower'
  ],
  cycle: [
    '사이클', '실내자전거', '따릉이', '스피닝', '바이크',
    '자전거', 'cycle', 'bike', 'spinning'
  ],
  other: [
    '엘립티컬', '줄넘기', '수영', '워킹', '걷기',
    'elliptical', 'swimming', 'walking'
  ],
};

/**
 * 운동명을 표준 Cardio 카테고리로 매핑
 */
export const mapToCardioCategory = (workoutName: string): CardioCategory => {
  const lowerName = workoutName.toLowerCase();

  for (const [category, keywords] of Object.entries(CARDIO_KEYWORDS)) {
    if (keywords.some(kw => lowerName.includes(kw.toLowerCase()))) {
      return category as CardioCategory;
    }
  }

  return 'other'; // 알 수 없으면 'other'로 처리
};

/**
 * 카테고리별 환산 비율 가져오기
 */
export const getCardioMultiplier = (workoutName: string): number => {
  const category = mapToCardioCategory(workoutName);
  return CARDIO_MULTIPLIERS[category];
};

/**
 * 환산 거리 계산 (집계 시 사용)
 *
 * 1순위: adjusted_dist_km (인클라인 보정된 거리)
 * 2순위: distance_km (원본 거리)
 * 그 후 cardio category multiplier 적용
 *
 * @param distance_km - 원본 거리 (km)
 * @param adjusted_dist_km - 인클라인 보정된 거리 (km)
 * @param workoutName - 운동 이름
 * @returns 환산 거리 (km)
 */
export const calculateAdjustedDistance = (
  distance_km: number | null,
  adjusted_dist_km: number | null,
  workoutName: string
): number => {
  // 인클라인 보정된 거리가 있으면 우선 사용, 없으면 원본 거리
  const baseDistance = adjusted_dist_km ?? distance_km ?? 0;

  if (baseDistance === 0) return 0;

  const multiplier = getCardioMultiplier(workoutName);
  return Number((baseDistance * multiplier).toFixed(2));
};

/**
 * 빈 필드 채우기 (거리, 속도 등 계산)
 * 원본 데이터에 누락된 필드를 계산해서 채움
 */
export const fillMissingCardioFields = (workout: Workout): Workout => {
  if (workout.type !== 'cardio') {
    return workout;
  }

  const result = { ...workout };

  // 거리가 없고 속도+시간이 있으면 거리 계산
  if (!result.distance_km && result.speed_kph && result.duration_min) {
    result.distance_km = Number((result.speed_kph * (result.duration_min / 60)).toFixed(2));
  }

  // 속도가 없고 거리+시간이 있으면 속도 계산
  if (!result.speed_kph && result.distance_km && result.duration_min && result.duration_min > 0) {
    result.speed_kph = Number((result.distance_km / (result.duration_min / 60)).toFixed(2));
  }

  return result;
};

/**
 * 카테고리별 UI 표시용 아이콘
 */
export const getCardioIcon = (workoutName: string): string => {
  const category = mapToCardioCategory(workoutName);
  const icons: Record<CardioCategory, string> = {
    running: '🏃',
    stepmill: '🪜',
    rowing: '🚣',
    cycle: '🚴',
    other: '💨',
  };
  return icons[category];
};

/**
 * 환산 비율 UI 표시용 텍스트
 */
export const getMultiplierText = (workoutName: string): string => {
  const multiplier = getCardioMultiplier(workoutName);
  return multiplier === 1.0 ? '' : `×${multiplier}`;
};

/**
 * 카테고리별 한글 이름
 */
export const getCardioCategoryName = (workoutName: string): string => {
  const category = mapToCardioCategory(workoutName);
  const names: Record<CardioCategory, string> = {
    running: '러닝',
    stepmill: '스텝밀',
    rowing: '로잉',
    cycle: '사이클',
    other: '기타 유산소',
  };
  return names[category];
};
