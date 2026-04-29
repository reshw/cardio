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
  allowed_categories: string[] | null;
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
}

// 유저별 집계 progress
export interface UserProgress {
  user_id: string;
  displayName: string;
  profileImage?: string;
  targets: {
    participant: ChallengeParticipant;
    current_value: number;
    pct: number;
    achieved: boolean;
  }[];
  overallPct: number;
  allAchieved: boolean;
}

const challengeService = {
  async getActiveChallengesForClub(clubId: string): Promise<Challenge[]> {
    const today = new Date().toISOString().split('T')[0];
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

  // 내 참여 목록 (다종목)
  async getMyParticipants(challengeId: string, userId: string): Promise<ChallengeParticipant[]> {
    const { data, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  },

  // 종목별 참여 선언 (단건)
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

  // 단일 종목 progress 계산
  async calcParticipantProgress(
    challenge: Challenge,
    participant: ChallengeParticipant
  ): Promise<{ current_value: number; pct: number; achieved: boolean }> {
    let query = supabase
      .from('workouts')
      .select('value')
      .eq('user_id', participant.user_id)
      .eq('category', participant.category)
      .gte('workout_time', challenge.start_date)
      .lte('workout_time', challenge.end_date + 'T23:59:59+09:00');

    if (participant.sub_type) {
      query = query.eq('sub_type', participant.sub_type);
    }

    const { data: workouts } = await query;
    const current_value = Math.round(
      (workouts || []).reduce((sum: number, w: { value: number }) => sum + w.value, 0) * 10
    ) / 10;
    const pct = Math.min(100, Math.round((current_value / participant.target_value) * 100));
    return { current_value, pct, achieved: pct >= 100 };
  },

  // 챌린지 전체 참여자 progress (유저별 그룹)
  async getParticipantsWithProgress(
    challenge: Challenge,
    clubId: string
  ): Promise<UserProgress[]> {
    const { data: participants, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id);

    if (error) throw error;
    if (!participants || participants.length === 0) return [];

    const userIds = [...new Set(participants.map((p: ChallengeParticipant) => p.user_id))];

    // 유저 정보 — club_nickname만 (users join FK 없음)
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id, club_nickname')
      .eq('club_id', clubId)
      .in('user_id', userIds);

    const memberMap: Record<string, any> = Object.fromEntries(
      (members || []).map((m: any) => [m.user_id, m])
    );

    // 운동 기록 한 번에
    const { data: workouts } = await supabase
      .from('workouts')
      .select('user_id, value, category, sub_type, workout_time')
      .in('user_id', userIds)
      .gte('workout_time', challenge.start_date)
      .lte('workout_time', challenge.end_date + 'T23:59:59+09:00');

    const wks = workouts || [];

    // 유저별 그룹
    const userMap: Record<string, ChallengeParticipant[]> = {};
    participants.forEach((p: ChallengeParticipant) => {
      if (!userMap[p.user_id]) userMap[p.user_id] = [];
      userMap[p.user_id].push(p);
    });

    return Object.entries(userMap).map(([userId, targets]) => {
      const member = memberMap[userId];
      const displayName = member?.club_nickname || '(닉네임 없음)';
      const profileImage = undefined;

      const targetProgresses = targets.map((p) => {
        const current_value = Math.round(
          wks
            .filter((w) =>
              w.user_id === userId &&
              w.category === p.category &&
              (p.sub_type ? w.sub_type === p.sub_type : true)
            )
            .reduce((sum: number, w: { value: number }) => sum + w.value, 0) * 10
        ) / 10;
        const pct = Math.min(100, Math.round((current_value / p.target_value) * 100));
        return { participant: p, current_value, pct, achieved: pct >= 100 };
      });

      const overallPct = Math.round(
        targetProgresses.reduce((sum, t) => sum + t.pct, 0) / targetProgresses.length
      );

      return {
        user_id: userId,
        displayName,
        profileImage,
        targets: targetProgresses,
        overallPct,
        allAchieved: targetProgresses.every((t) => t.achieved),
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
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
