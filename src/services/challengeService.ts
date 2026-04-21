import { supabase } from '../lib/supabase';

export type GoalMetric = 'total_workouts' | 'total_distance' | 'total_duration' | 'total_volume' | 'custom';

export interface Challenge {
  id: string;
  scope: 'global' | 'club';
  club_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  goal_metric: GoalMetric;
  goal_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'failed';
  theme_color: string;
  created_at: string;
}

export interface CreateChallengeData {
  club_id: string;
  created_by: string;
  title: string;
  description?: string;
  goal_metric: GoalMetric;
  goal_value: number;
  start_date: string;
  end_date: string;
  theme_color?: string;
}

const METRIC_LABELS: Record<GoalMetric, string> = {
  total_workouts: '총 운동 횟수',
  total_distance: '총 거리 (km)',
  total_duration: '총 시간 (분)',
  total_volume: '총 운동량',
  custom: '목표 달성',
};

const METRIC_UNITS: Record<GoalMetric, string> = {
  total_workouts: '회',
  total_distance: 'km',
  total_duration: '분',
  total_volume: '',
  custom: '',
};

const challengeService = {
  METRIC_LABELS,
  METRIC_UNITS,

  async getActiveChallengesForClub(clubId: string): Promise<Challenge[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .or(`scope.eq.global,club_id.eq.${clubId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // userId 지정 시 개인 진행률, 없으면 클럽 전체 집계
  async calcProgress(challenge: Challenge, clubId: string, userId?: string): Promise<number> {
    const start = challenge.start_date;
    const end = challenge.end_date + 'T23:59:59+09:00';

    let query = supabase
      .from('workouts')
      .select('value, unit')
      .gte('workout_time', start)
      .lte('workout_time', end);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      const { data: members } = await supabase
        .from('club_members')
        .select('user_id')
        .eq('club_id', clubId);
      const memberIds = (members || []).map((m: { user_id: string }) => m.user_id);
      if (memberIds.length === 0) return 0;
      query = query.in('user_id', memberIds);
    }

    const { data: wks } = await query;

    if (!wks) return 0;

    switch (challenge.goal_metric) {
      case 'total_workouts':
        return wks.length;
      case 'total_distance':
        return Math.round(
          wks.filter((w) => w.unit === 'km').reduce((s, w) => s + w.value, 0) * 10
        ) / 10;
      case 'total_duration':
        return wks.filter((w) => w.unit === '분').reduce((s, w) => s + w.value, 0);
      case 'total_volume':
        return wks.reduce((s, w) => s + w.value, 0);
      case 'custom':
        return Math.round(
          wks.filter((w) => w.unit === 'km').reduce((s, w) => s + w.value, 0) * 10
        ) / 10;
    }
  },

  async createChallenge(data: CreateChallengeData): Promise<Challenge> {
    const { data: created, error } = await supabase
      .from('challenges')
      .insert({
        scope: 'club',
        club_id: data.club_id,
        created_by: data.created_by,
        title: data.title,
        description: data.description || null,
        goal_metric: data.goal_metric,
        goal_value: data.goal_value,
        start_date: data.start_date,
        end_date: data.end_date,
        theme_color: data.theme_color || '#8b5cf6',
        status: 'active',
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

  getDaysLeft(endDate: string): number {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = end.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  },
};

export default challengeService;
