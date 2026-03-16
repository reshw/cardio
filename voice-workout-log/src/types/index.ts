export type RecordingState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'parsing'
  | 'review'
  | 'error';

// Matrix Classification: 2축 분류 체계
// 축 1: Category (카테고리) - "어디서/어떤 판에서 놀았는가?"
export type WorkoutCategory = 'gym' | 'snowboard' | 'running' | 'sports' | 'home' |'cycle' | 'other';

// 축 2: Type (트레이닝 타입) - "몸을 어떻게 조졌는가?"
export type WorkoutType = 'strength' | 'cardio' | 'skill' | 'flexibility' | 'unknown';

// Level 3: Target (타겟 부위) - "어디를 조졌는가?" (근력 운동 상세 분류)
export type WorkoutTarget = 'upper' | 'lower' | 'core' | 'full' | 'none';

// Legacy type for backward compatibility
export type LegacyWorkoutType = 'strength' | 'cardio' | 'core' | 'mobility' | 'snowboard' | 'unknown';

export interface Workout {
  name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  duration_min: number | null;
  distance_km: number | null;
  pace: string | null; // "5:30" (5분 30초/km)

  // Matrix Classification
  category: WorkoutCategory; // 카테고리 (장소/종목)
  type: WorkoutType; // 트레이닝 타입 (운동 효과)
  target?: WorkoutTarget; // 타겟 부위 (근력 운동만 해당)

  // Cardio 상세 정보
  speed_kph?: number | null; // 속도 (km/h)
  incline_percent?: number | null; // 경사도 (%)
  resistance_level?: number | null; // 저항 레벨 (사이클, 로잉 등)
  cadence?: number | null; // RPM, SPM
  watts?: number | null;   // Power

  // Type별 전용 비교 지표 (리더보드용)
  adjusted_dist_km?: number | null; // 🏃 카디오: 평지 환산 거리 (인클라인 보정) - DEPRECATED, 집계 시 계산
  volume_kg?: number | null; // 🏋️ 근력: 총 볼륨 (무게 * 세트 * 횟수)
  run_count?: number | null; // 🏂 스킬/스노보드: 런 수 / 시도 횟수

  note: string | null;
}

export interface WorkoutLog {
  id: string;
  date: string; // YYYY-MM-DD
  rawText: string;
  normalizedText: string;
  workouts: Workout[];
  memo: string | null;
  createdAt: number;
  isPrivate?: boolean; // 비공개 여부 (true: 나만 보기, false: 클럽 멤버와 공유)
  // 클럽 멤버 로그 조회 시 추가 정보
  userId?: string;
  userDisplayName?: string;
  userProfileImage?: string | null;
}

export interface SpeechRecognitionHookResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export interface UserProfile {
  // 기본 정보
  age?: number;
  gender?: 'male' | 'female' | 'other';
  height?: number; // cm
  weight?: number; // kg

  // 운동 경력 & 수준
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced'; // 입문/초급/중급/고급
  experienceMonths?: number; // 운동 경력 (개월)

  // 목표 & 선호
  goals: string; // AI가 정리한 운동 목표 및 배경
  primaryGoal?: 'muscle_gain' | 'strength' | 'endurance' | 'weight_loss' | 'sport_performance' | 'general_fitness';
  preferredWorkouts?: string[]; // 선호 운동 종류
  avoidedWorkouts?: string[]; // 회피할 운동 (부상 등)

  // 제약 사항
  injuries?: string[]; // 부상 이력
  availableEquipment?: 'home' | 'gym' | 'bodyweight' | 'mixed';
  availableTime?: {
    sessionsPerWeek: number;
    minutesPerSession: number;
  };

  // 라이프스타일
  activityLevel?: 'sedentary' | 'moderate' | 'active' | 'very_active';
  sleepHours?: number;
  stressLevel?: 'low' | 'medium' | 'high';

  // 난이도 선호도
  preferredIntensity?: {
    weight: 'conservative' | 'moderate' | 'progressive'; // 무게 증가 속도
    volume: 'low' | 'medium' | 'high'; // 운동량
  };

  // 메타 정보
  rawInput?: string; // 사용자가 입력한 원본 텍스트 (참고용)
  conversationHistory?: Array<{
    question: string;
    answer: string;
    timestamp: number;
  }>; // 대화 이력
  createdAt: number;
  updatedAt: number;
}

export interface TodoWorkout {
  name: string;
  sets?: number;
  reps?: number;
  weight_kg?: number;
  duration_min?: number;
  distance_km?: number;
  pace?: string;
  note?: string;
  completed: boolean;
}

export interface DailyTodo {
  id: string;
  date: string; // YYYY-MM-DD
  source: 'ai_recommendation' | 'manual'; // AI 추천인지 수동 추가인지

  // AI 추천 상세 정보
  aiRecommendation?: {
    analysisResult: string;      // STEP 1: 데이터 분석 결과
    initialRecommendation: string; // STEP 2: 초기 추천
    conversationHistory?: Array<{  // 대화 이력
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }>;
    finalRecommendation: string;   // 최종 확정된 추천
    userFeedback?: string;         // 사용자 피드백/수정 내용
    finalizedAt?: number;          // 확정 시간
  };

  workouts: TodoWorkout[];
  createdAt: number;
}

// ============================================
// Clubs System Types
// ============================================

// Dashboard Widget Types
export type DashboardWidgetType = 'live_ticker' | 'hall_of_fame' | 'daily_squad' | 'leaderboard';

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  visible: boolean;
  order: number;
  config?: {
    metricType?: 'cardio' | 'strength' | 'snowboard';
    [key: string]: any;
  };
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
}

export interface Club {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  invite_code: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  dashboard_config?: DashboardConfig;
}

export interface ClubWithMemberInfo extends Club {
  my_role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface ClubDetail extends Club {
  member_count: number;
  active_challenge_count: number;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface User {
  id: string;
  username: string;
  display_name: string;
  profile_image: string | null;
}

export interface ClubMemberWithUser extends ClubMember {
  user: User;
}

export interface ClubFeed {
  id: string;
  club_id: string;
  user_id: string;
  workout_log_id: string;
  shared_at: string;
}

export interface ClubFeedWithDetails extends Omit<ClubFeed, 'user_id' | 'workout_log_id'> {
  user: User;
  workout_log: WorkoutLog;
}

// ============================================
// Two-Track Challenge System Types
// ============================================

export type ChallengeScope = 'global' | 'club';
export type ChallengeGoalMetric = 'total_workouts' | 'total_volume' | 'total_duration' | 'total_distance';
export type ChallengeStatus = 'active' | 'completed' | 'failed';

// Global 챌린지 메타데이터
export interface GlobalChallengeMetadata {
  season?: string; // "2026-Winter"
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  badge_url?: string;
  reward?: string;
}

// Club 챌린지 메타데이터
export interface ClubChallengeMetadata {
  bet_mode?: boolean;
  penalty?: string; // "댄스영상 올리기"
  meme_image?: string;
  custom_data?: Record<string, any>;
}

export interface Challenge {
  id: string;
  scope: ChallengeScope;
  club_id: string | null; // global이면 null, club이면 필수
  created_by: string;

  title: string;
  description: string | null;

  goal_metric: ChallengeGoalMetric;
  goal_value: number;
  current_value: number;

  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD

  status: ChallengeStatus;

  meta_data: GlobalChallengeMetadata | ClubChallengeMetadata | Record<string, any>;

  origin_challenge_id: string | null; // 포크된 경우 원본 ID

  created_at: string;
  updated_at: string;
}

// 기존 ClubChallenge 타입은 호환성을 위해 유지 (deprecated)
// @deprecated Use Challenge with scope='club' instead
export interface ClubChallenge {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  challenge_type: ChallengeGoalMetric;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChallengeContributor {
  user: User;
  total_contribution: number;
}

export interface ChallengeDetailWithContributors extends ClubChallenge {
  contributors: ChallengeContributor[];
}
