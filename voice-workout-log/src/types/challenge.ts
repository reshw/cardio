/**
 * Challenge Maker - Type Definitions
 * Quest Builder용 타입 정의
 */

import type { WorkoutCategory, WorkoutType } from './index';

// 추적할 지표 타입
export type MetricType =
  | 'volume_kg' // 볼륨 (근력)
  | 'adjusted_dist_km' // 거리 (유산소)
  | 'duration_min' // 시간 (지구력)
  | 'run_count' // 런 수 (스노보드/기술)
  | 'workout_count' // 운동 횟수
  | 'attendance_days'; // 출석 일수

// 챌린지 테마 (Step 1)
export type QuestTheme = 'strength' | 'endurance' | 'skill' | 'consistency';

// 집계 방식
export type AggregationType = 'sum' | 'count';

// 챌린지 규칙 (JSONB 구조)
export interface ChallengeRules {
  target_metric: MetricType; // 추적할 컬럼
  filter: {
    category?: WorkoutCategory[]; // 카테고리 필터 (비어있으면 전체)
    type?: WorkoutType[]; // 타입 필터 (비어있으면 전체)
    keyword_include?: string[]; // 운동 이름에 포함되어야 하는 키워드
    keyword_exclude?: string[]; // 운동 이름에 포함되면 안되는 키워드
  };
  aggregation: AggregationType; // 합산 방식
  goal_value: number; // 목표 수치
  unit: string; // 표시 단위 (kg, km, 분, 회, 일)
}

// 챌린지 생성 DTO
export interface CreateChallengeDTO {
  club_id: string;
  title: string;
  description?: string;
  rules: ChallengeRules;
  start_date: string;
  end_date: string;
  theme_color?: string; // 테마 색상
}

// 챌린지 템플릿
export interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  theme: QuestTheme;
  rules: ChallengeRules;
  recommended_duration_days: number; // 권장 기간
}

// 참조 가이드 (목표 수치 도우미)
export interface ReferenceGuide {
  value: number;
  description: string;
  emoji: string;
}

// 인기 템플릿 목록
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'powerlifting_500',
    name: '3대 500 달성',
    description: '스쿼트+벤치프레스+데드리프트 총 볼륨 500kg',
    emoji: '🏋️',
    theme: 'strength',
    rules: {
      target_metric: 'volume_kg',
      filter: {
        category: ['gym', 'home'],
        type: ['strength'],
        keyword_include: ['squat', 'bench', 'deadlift', '스쿼트', '벤치', '데드'],
      },
      aggregation: 'sum',
      goal_value: 500000, // 500톤
      unit: 'kg',
    },
    recommended_duration_days: 90,
  },
  {
    id: 'seoul_busan',
    name: '서울-부산 완주',
    description: '총 거리 400km 누적',
    emoji: '🏃',
    theme: 'endurance',
    rules: {
      target_metric: 'adjusted_dist_km',
      filter: {
        category: ['running', 'gym'],
        type: ['cardio'],
      },
      aggregation: 'sum',
      goal_value: 400,
      unit: 'km',
    },
    recommended_duration_days: 60,
  },
  {
    id: 'everest_climb',
    name: '에베레스트 등정',
    description: '스노보드 런 8,848회 달성',
    emoji: '🏂',
    theme: 'skill',
    rules: {
      target_metric: 'run_count',
      filter: {
        category: ['snowboard'],
      },
      aggregation: 'sum',
      goal_value: 8848,
      unit: '회',
    },
    recommended_duration_days: 120,
  },
  {
    id: 'perfect_attendance',
    name: '개근상',
    description: '30일 연속 출석',
    emoji: '📅',
    theme: 'consistency',
    rules: {
      target_metric: 'attendance_days',
      filter: {},
      aggregation: 'count',
      goal_value: 30,
      unit: '일',
    },
    recommended_duration_days: 30,
  },
  {
    id: 'squat_titan',
    name: '스쿼트 100톤',
    description: '스쿼트 운동만 100톤 누적',
    emoji: '🦵',
    theme: 'strength',
    rules: {
      target_metric: 'volume_kg',
      filter: {
        category: ['gym', 'home'],
        type: ['strength'],
        keyword_include: ['squat', '스쿼트'],
      },
      aggregation: 'sum',
      goal_value: 100000,
      unit: 'kg',
    },
    recommended_duration_days: 60,
  },
];

// 목표 수치 참조 가이드
export const REFERENCE_GUIDES: Record<MetricType, ReferenceGuide[]> = {
  volume_kg: [
    { value: 1000, description: '경차 1대', emoji: '🚗' },
    { value: 10000, description: '덤프트럭 1대', emoji: '🚛' },
    { value: 100000, description: '고래 1마리', emoji: '🐋' },
    { value: 500000, description: '보잉 747 기체', emoji: '✈️' },
  ],
  adjusted_dist_km: [
    { value: 42.195, description: '마라톤 풀코스', emoji: '🏃' },
    { value: 100, description: '울트라 마라톤', emoji: '🦸' },
    { value: 400, description: '서울-부산 거리', emoji: '🚄' },
    { value: 10000, description: '서울-뉴욕 편도', emoji: '✈️' },
  ],
  duration_min: [
    { value: 60, description: '1시간', emoji: '⏰' },
    { value: 600, description: '10시간', emoji: '⏳' },
    { value: 3000, description: '50시간 (2일)', emoji: '🌙' },
    { value: 10000, description: '1주일', emoji: '📅' },
  ],
  run_count: [
    { value: 100, description: '초보 보더', emoji: '🏂' },
    { value: 500, description: '중급 라이더', emoji: '⛷️' },
    { value: 1000, description: '프로 수준', emoji: '🏆' },
    { value: 8848, description: '에베레스트 고도', emoji: '🏔️' },
  ],
  workout_count: [
    { value: 50, description: '꾸준한 시작', emoji: '💪' },
    { value: 100, description: '습관 형성', emoji: '🎯' },
    { value: 500, description: '철인 수준', emoji: '🦾' },
    { value: 1000, description: '레전드', emoji: '👑' },
  ],
  attendance_days: [
    { value: 7, description: '1주일 개근', emoji: '📅' },
    { value: 30, description: '한 달 개근', emoji: '🗓️' },
    { value: 100, description: '100일 챌린지', emoji: '💯' },
    { value: 365, description: '1년 개근', emoji: '🏆' },
  ],
};
