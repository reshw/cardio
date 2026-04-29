import { supabase } from '../lib/supabase';

export type GoalMetric = 'total_workouts' | 'total_distance' | 'total_duration' | 'total_volume' | 'custom';

export const METRIC_LABELS: Record<GoalMetric, string> = {
  total_workouts: '총 운동 횟수',
  total_distance: '총 거리 (km)',
  total_duration: '총 시간 (분)',
  total_volume: '총 운동량',
  custom: '목표 달성',
};

export const METRIC_UNITS: Record<GoalMetric, string> = {
  total_workouts: '회',
  total_distance: 'km',
  total_duration: '분',
  total_volume: '',
  custom: '',
};

export interface Challenge {
  id: string;
  scope: 'global' | 'club';
  club_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  goal_metric: GoalMetric | null;
  goal_value: number | null;
  current_value: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'ended';
  theme_color: string;
  allowed_categories: string[] | null; // null = 전체 허용
  created_at: string;
}

export interface CreateChallengeData {
  club_id: string;
  created_by: string;
  title: string;
  start_date: string;
  end_date: string;
  allowed_categories?: string[] | null;
}

export interface ChallengeParticipant {
  id: string;
  challenge_id: string;
  user_id: string;
  category: string;
  sub_type: string | null;
  target_value: number;
  unit: string;
  created_at: string;
  // 조인 결과
  user?: {
    display_name: string;
    profile_image?: string;
    club_nickname?: string;
  };
}

export interface ParticipantProgress {
  participant: ChallengeParticipant;
  current_value: number;
  pct: number;
  achieved: boolean;
}

const challengeService = {
  async getActiveChallengesForClub(clubId: string): Promise<Challenge[]> {
    const today = new Date().toISOString().split('T')[0];
    // 종료 후 1주일까지 노출
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('club_id', clubId)
      .eq('scope', 'club')
      .lte('start_date', today)
      .gte('end_date', oneWeekAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createChallenge(data: CreateChallengeData): Promise<Challenge> {
    const { data: created, error } = await supabase
      .from('challenges')
      .insert({
        scope: 'club',
        club_id: data.club_id,
        created_by: data.created_by,
        title: data.title,
        start_date: data.start_date,
        end_date: data.end_date,
        allowed_categories: data.allowed_categories ?? null,
        status: 'active',
        theme_color: '#8b5cf6',
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  },

  async deleteChallenge(challengeId: string): Promise<void> {
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId);
    if (error) throw error;
  },

  // 내 참여 정보 조회
  async getMyParticipant(challengeId: string, userId: string): Promise<ChallengeParticipant | null> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // 챌린지 참여 선언
  async joinChallenge(params: {
    challenge_id: string;
    user_id: string;
    category: string;
    sub_type: string | null;
    target_value: number;
    unit: string;
  }): Promise<ChallengeParticipant> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .insert(params)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 챌린지 전체 참여자 목록 (달성률 계산 포함)
  async getParticipantsWithProgress(
    challenge: Challenge,
    _clubId: string
  ): Promise<ParticipantProgress[]> {
    // 참여자 목록
    const { data: participants, error } = await supabase
      .from('challenge_participants')
      .select(`
        *,
        user:club_members!inner(club_nickname, user:users(display_name, profile_image))
      `)
      .eq('challenge_id', challenge.id);

    if (error) throw error;
    if (!participants || participants.length === 0) return [];

    // 챌린지 기간 내 전체 운동 기록 한 번에 가져오기
    const userIds = participants.map((p: ChallengeParticipant) => p.user_id);
    const { data: workouts } = await supabase
      .from('workouts')
      .select('user_id, value, unit, category, sub_type, workout_time')
      .in('user_id', userIds)
      .gte('workout_time', challenge.start_date)
      .lte('workout_time', challenge.end_date + 'T23:59:59+09:00');

    const wks = workouts || [];

    return participants.map((p: ChallengeParticipant) => {
      const current_value = wks
        .filter((w) =>
          w.user_id === p.user_id &&
          w.category === p.category &&
          (p.sub_type ? w.sub_type === p.sub_type : true)
        )
        .reduce((sum: number, w: { value: number }) => sum + w.value, 0);

      const pct = Math.min(100, Math.round((current_value / p.target_value) * 100));
      return { participant: p, current_value, pct, achieved: pct >= 100 };
    });
  },

  // 내 종목별 달성도
  async getMyProgress(
    challenge: Challenge,
    userId: string,
    participant: ChallengeParticipant
  ): Promise<{ current_value: number; pct: number; achieved: boolean }> {
    let query = supabase
      .from('workouts')
      .select('value')
      .eq('user_id', userId)
      .eq('category', participant.category)
      .gte('workout_time', challenge.start_date)
      .lte('workout_time', challenge.end_date + 'T23:59:59+09:00');

    if (participant.sub_type) {
      query = query.eq('sub_type', participant.sub_type);
    }

    const { data: workouts } = await query;
    const current_value = (workouts || []).reduce((sum: number, w: { value: number }) => sum + w.value, 0);
    const pct = Math.min(100, Math.round((current_value / participant.target_value) * 100));
    return { current_value, pct, achieved: pct >= 100 };
  },

  getDaysLeft(endDate: string): number {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = end.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  },

  isEnded(endDate: string): boolean {
    return new Date(endDate) < new Date(new Date().setHours(0, 0, 0, 0));
  },
};

export default challengeService;
