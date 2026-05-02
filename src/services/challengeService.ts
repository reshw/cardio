import { supabase } from '../lib/supabase';

// KST(UTC+9) 기준 오늘 날짜를 'YYYY-MM-DD' 문자열로 반환
const todayKST = (): string => {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  return kst.toISOString().split('T')[0];
};

// 'YYYY-MM-DD' 문자열 기준 날짜 차이 (a - b, 일 단위)
const dateStrDiff = (a: string, b: string): number => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / msPerDay);
};

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
  allow_late_join: boolean;
  created_at: string;
}

export interface CreateChallengeData {
  club_id: string;
  created_by: string;
  title: string;
  start_date: string;
  end_date: string;
  allowed_categories?: string[] | null;
  allow_late_join?: boolean;
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
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('club_id', clubId)
      .eq('scope', 'club')
      .gte('end_date', oneWeekAgo)   // 종료 후 1주일까지만 표시 (start_date 제한 제거)
      .order('start_date', { ascending: true });

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
        allow_late_join: data.allow_late_join ?? false,
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

  // 단일 종목 progress 계산 (단건용, 내부적으로 bulk 위임)
  async calcParticipantProgress(
    challenge: Challenge,
    participant: ChallengeParticipant
  ): Promise<{ current_value: number; pct: number; achieved: boolean }> {
    const results = await this.calcMyProgressBulk(challenge, [participant]);
    return results[0] ?? { current_value: 0, pct: 0, achieved: false };
  },

  // 내 참여 종목 전체를 workouts 1회 쿼리로 계산
  async calcMyProgressBulk(
    challenge: Challenge,
    participants: ChallengeParticipant[]
  ): Promise<{ current_value: number; pct: number; achieved: boolean }[]> {
    if (participants.length === 0) return [];

    const { data: workouts } = await supabase
      .from('workouts')
      .select('value, category, sub_type')
      .eq('user_id', participants[0].user_id)
      .gte('workout_time', challenge.start_date + 'T00:00:00+09:00')
      .lte('workout_time', challenge.end_date + 'T23:59:59+09:00');

    const wks = workouts || [];
    return participants.map((p) => {
      const current_value = Math.round(
        wks
          .filter((w) => w.category === p.category && (p.sub_type ? w.sub_type === p.sub_type : true))
          .reduce((sum, w) => sum + w.value, 0) * 10
      ) / 10;
      const pct = Math.min(100, Math.round((current_value / p.target_value) * 100));
      return { current_value, pct, achieved: pct >= 100 };
    });
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
      .gte('workout_time', challenge.start_date + 'T00:00:00+09:00')
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
    const diff = dateStrDiff(endDate, todayKST());
    return Math.max(0, diff);
  },

  isEnded(endDate: string): boolean {
    return dateStrDiff(endDate, todayKST()) < 0;
  },

  isUpcoming(startDate: string): boolean {
    return dateStrDiff(startDate, todayKST()) > 0;
  },

  getDaysUntilStart(startDate: string): number {
    return dateStrDiff(startDate, todayKST());
  },

  getChallengeDuration(startDate: string, endDate: string): number {
    return dateStrDiff(endDate, startDate) + 1;
  },

  // 목표 검증: 챌린지 시작 전 30일 실적 기반 개인별 목표 적정성 분석
  async getGoalValidation(
    challenge: Challenge,
    clubId: string
  ): Promise<GoalValidationRow[]> {
    const { data: participants, error } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id);
    if (error) throw error;
    if (!participants || participants.length === 0) return [];

    const userIds = [...new Set(participants.map((p: ChallengeParticipant) => p.user_id))];

    const { data: members } = await supabase
      .from('club_members')
      .select('user_id, club_nickname')
      .eq('club_id', clubId)
      .in('user_id', userIds);
    const memberMap: Record<string, string> = Object.fromEntries(
      (members || []).map((m: any) => [m.user_id, m.club_nickname || ''])
    );

    // 기준 기간: start_date 기준 30일 전 ~ 하루 전
    const refEnd = new Date(challenge.start_date);
    refEnd.setDate(refEnd.getDate() - 1);
    const refStart = new Date(challenge.start_date);
    refStart.setDate(refStart.getDate() - 30);
    const refStartStr = refStart.toISOString().split('T')[0];
    const refEndStr = refEnd.toISOString().split('T')[0];

    const duration = dateStrDiff(challenge.end_date, challenge.start_date) + 1;

    const { data: workouts } = await supabase
      .from('workouts')
      .select('user_id, value, category, sub_type')
      .in('user_id', userIds)
      .gte('workout_time', refStartStr + 'T00:00:00+09:00')
      .lte('workout_time', refEndStr + 'T23:59:59+09:00');
    const wks = workouts || [];

    return participants.map((p: ChallengeParticipant) => {
      const displayName = memberMap[p.user_id] || p.user_id.slice(0, 8);
      const refTotal = wks
        .filter((w) => w.user_id === p.user_id && w.category === p.category && (p.sub_type ? w.sub_type === p.sub_type : true))
        .reduce((sum, w) => sum + w.value, 0);
      const dailyAvg = refTotal / 30;
      const projected = dailyAvg * duration;
      const ratio = projected > 0 ? Math.round((p.target_value / projected) * 100) : null;

      let verdict: '😴 낮음' | '✅ 적정' | '🔥 도전적' | '⚠️ 과도' | '📊 데이터 없음';
      if (ratio === null || refTotal === 0) verdict = '📊 데이터 없음';
      else if (ratio < 70) verdict = '😴 낮음';
      else if (ratio <= 130) verdict = '✅ 적정';
      else if (ratio <= 200) verdict = '🔥 도전적';
      else verdict = '⚠️ 과도';

      return {
        user_id: p.user_id,
        displayName,
        category: p.category,
        sub_type: p.sub_type,
        target_value: p.target_value,
        unit: p.unit,
        daily_avg: Math.round(dailyAvg * 10) / 10,
        projected: Math.round(projected * 10) / 10,
        ratio,
        verdict,
        ref_period: `${refStartStr} ~ ${refEndStr}`,
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
  },
};

export interface GoalValidationRow {
  user_id: string;
  displayName: string;
  category: string;
  sub_type: string | null;
  target_value: number;
  unit: string;
  daily_avg: number;
  projected: number;
  ratio: number | null;
  verdict: '😴 낮음' | '✅ 적정' | '🔥 도전적' | '⚠️ 과도' | '📊 데이터 없음';
  ref_period: string;
}

export default challengeService;
