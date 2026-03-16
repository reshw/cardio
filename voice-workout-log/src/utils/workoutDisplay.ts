import type { WorkoutCategory, WorkoutType } from '../types';

/**
 * Matrix Classification 시각화 유틸리티
 *
 * 아이콘 (Category) + 색상 (Type) 조합으로 운동을 시각적으로 표현
 */

// Category별 아이콘 매핑
export const getCategoryIcon = (category: WorkoutCategory): string => {
  const iconMap: Record<WorkoutCategory, string> = {
    gym: '🏋️',
    snowboard: '🏂',
    running: '🏃',
    sports: '⚽',
    home: '🏠',
    cycle: '🚴',
    other: '💪',
  };
  return iconMap[category] || '💪';
};

// Category별 라벨
export const getCategoryLabel = (category: WorkoutCategory): string => {
  const labelMap: Record<WorkoutCategory, string> = {
    gym: '헬스장',
    snowboard: '스노보드',
    running: '러닝',
    sports: '스포츠',
    home: '홈트',
    cycle: '사이클',
    other: '기타',
  };
  return labelMap[category] || '기타';
};

// Type별 색상 매핑 (테두리/배경용)
export const getTypeColor = (type: WorkoutType): string => {
  const colorMap: Record<WorkoutType, string> = {
    strength: '#EF4444', // 빨강 (강렬함, 근력)
    cardio: '#3B82F6',   // 파랑 (숨참, 지구력)
    skill: '#A855F7',    // 보라 (고급, 테크닉)
    flexibility: '#10B981', // 초록 (유연성, 편안함)
    unknown: '#6B7280',  // 회색 (미분류)
  };
  return colorMap[type] || '#6B7280';
};

// Type별 라벨
export const getTypeLabel = (type: WorkoutType): string => {
  const labelMap: Record<WorkoutType, string> = {
    strength: '근력',
    cardio: '심폐',
    skill: '기술',
    flexibility: '유연성',
    unknown: '미분류',
  };
  return labelMap[type] || '미분류';
};

// Type별 밝은 배경색 (카드 배경용)
export const getTypeLightColor = (type: WorkoutType): string => {
  const lightColorMap: Record<WorkoutType, string> = {
    strength: '#FEE2E2',   // 빨강 밝은색
    cardio: '#DBEAFE',     // 파랑 밝은색
    skill: '#F3E8FF',      // 보라 밝은색
    flexibility: '#D1FAE5', // 초록 밝은색
    unknown: '#F3F4F6',    // 회색 밝은색
  };
  return lightColorMap[type] || '#F3F4F6';
};

// 운동 카드 스타일 생성 (인라인 스타일 객체)
export const getWorkoutCardStyle = (
  _category: WorkoutCategory,
  type: WorkoutType
): React.CSSProperties => {
  return {
    border: `2px solid ${getTypeColor(type)}`,
    backgroundColor: getTypeLightColor(type),
    borderRadius: '8px',
    padding: '12px',
    position: 'relative',
    transition: 'all 0.2s ease',
  };
};

// 운동 카드 헤더 스타일 (아이콘 + 이름)
export const getWorkoutCardHeader = (
  category: WorkoutCategory,
  name: string
): string => {
  const icon = getCategoryIcon(category);
  return `${icon} ${name}`;
};

// Type 뱃지 스타일
export const getTypeBadgeStyle = (type: WorkoutType): React.CSSProperties => {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: getTypeColor(type),
    color: 'white',
    marginLeft: '8px',
  };
};
