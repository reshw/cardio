import type { ExclusionSnapshot } from '../services/clubService';

export interface WorkoutStatusLabel {
  /** 배지를 표시해야 하는지 (미적립 상태) */
  show: boolean;
  /** 배지 문구 */
  text: string;
  /** 배지 배경색 (제외 규칙이면 커스텀, 아니면 기본 회색 계열) */
  bgColor?: string;
  /** 배지 텍스트색 */
  fgColor?: string;
  /** 제외 규칙에 의한 미적립인지 (기본 계수 0 미적립과 구별) */
  isRuleExcluded: boolean;
}

/**
 * 운동의 마일리지 상태 배지 정보를 계산.
 * - exclusion_snapshot 이 있으면 → 규칙 이름/색상 배지 (예: "폭염제외")
 * - 없고 mileage=0 이면 → 기본 "미적립" 배지
 * - mileage>0 이면 → 배지 없음
 */
export function getWorkoutStatusLabel(
  mileage: number | undefined,
  exclusionSnapshot?: ExclusionSnapshot | null
): WorkoutStatusLabel {
  if (exclusionSnapshot && exclusionSnapshot.name) {
    return {
      show: true,
      text: exclusionSnapshot.name,
      bgColor: exclusionSnapshot.label_bg_color,
      fgColor: exclusionSnapshot.label_fg_color,
      isRuleExcluded: true,
    };
  }

  if (mileage !== undefined && mileage === 0) {
    return { show: true, text: '미적립', isRuleExcluded: false };
  }

  return { show: false, text: '', isRuleExcluded: false };
}
