import type {
  Challenge,
  ChallengeScope,
  ChallengeGoalMetric,
  ChallengeStatus,
  ChallengeDetailWithContributors,
} from '../types';
import { supabase } from '../lib/supabase';

// Get current user ID from localStorage
const getCurrentUserId = (): string => {
  const userStr = localStorage.getItem('current_user');
  if (!userStr) throw new Error('로그인이 필요합니다.');
  const user = JSON.parse(userStr);
  return user.id;
};

// ============================================
// Challenge CRUD Functions (Two-Track)
// ============================================

export const createChallenge = async (data: {
  scope: ChallengeScope;
  club_id?: string;
  title: string;
  description?: string;
  goal_metric: ChallengeGoalMetric;
  goal_value: number;
  start_date: string;
  end_date: string;
  meta_data?: Record<string, any>;
}): Promise<Challenge> => {
  try {
    const userId = getCurrentUserId();

    const { data: challenge, error } = await supabase
      .from('challenges')
      .insert({
        scope: data.scope,
        club_id: data.club_id || null,
        title: data.title,
        description: data.description || null,
        goal_metric: data.goal_metric,
        goal_value: data.goal_value,
        start_date: data.start_date,
        end_date: data.end_date,
        meta_data: data.meta_data || {},
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return challenge;
  } catch (error) {
    console.error('챌린지 생성 실패:', error);
    throw new Error('챌린지 생성에 실패했습니다.');
  }
};

// 글로벌 챌린지 조회
export const getGlobalChallenges = async (
  statusFilter?: ChallengeStatus
): Promise<Challenge[]> => {
  try {
    let query = supabase
      .from('challenges')
      .select('*')
      .eq('scope', 'global');

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('글로벌 챌린지 조회 실패:', error);
    throw new Error('챌린지 목록을 불러오는데 실패했습니다.');
  }
};

// 클럽 챌린지 조회
export const getClubChallenges = async (
  clubId: string,
  statusFilter?: ChallengeStatus
): Promise<Challenge[]> => {
  try {
    let query = supabase
      .from('challenges')
      .select('*')
      .eq('scope', 'club')
      .eq('club_id', clubId);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('클럽 챌린지 조회 실패:', error);
    throw new Error('챌린지 목록을 불러오는데 실패했습니다.');
  }
};

// 활성 챌린지 조회 (Active만)
export const getActiveChallenges = async (clubId?: string): Promise<Challenge[]> => {
  try {
    let query = supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active');

    if (clubId) {
      // 특정 클럽의 active 챌린지만
      query = query.eq('scope', 'club').eq('club_id', clubId);
    }

    const { data, error } = await query.order('end_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('활성 챌린지 조회 실패:', error);
    throw new Error('챌린지 목록을 불러오는데 실패했습니다.');
  }
};

// 챌린지 상세 조회
export const getChallengeDetail = async (
  challengeId: string
): Promise<ChallengeDetailWithContributors> => {
  try {
    // 1. Get challenge info
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError) throw challengeError;

    // 2. Get contributor rankings
    const { data: contributions, error: contributionError } = await supabase
      .from('challenge_participants')
      .select(`
        user_id,
        users (
          id,
          username,
          display_name,
          profile_image
        ),
        contribution_value
      `)
      .eq('challenge_id', challengeId);

    if (contributionError) throw contributionError;

    // Aggregate by user and sort
    const contributorMap = new Map<string, any>();
    (contributions || []).forEach((item: any) => {
      const userId = item.user_id;
      if (!contributorMap.has(userId)) {
        contributorMap.set(userId, {
          user: item.users,
          total_contribution: 0,
        });
      }
      const contributor = contributorMap.get(userId);
      contributor.total_contribution += item.contribution_value;
    });

    const contributors = Array.from(contributorMap.values()).sort(
      (a, b) => b.total_contribution - a.total_contribution
    );

    return {
      ...challenge,
      // Map new field names to old for compatibility
      challenge_type: challenge.goal_metric,
      target_value: challenge.goal_value,
      contributors,
    } as any;
  } catch (error) {
    console.error('챌린지 상세 조회 실패:', error);
    throw new Error('챌린지 정보를 불러오는데 실패했습니다.');
  }
};

// 챌린지 수정
export const updateChallenge = async (
  challengeId: string,
  updates: Partial<Pick<Challenge, 'title' | 'description' | 'status' | 'meta_data'>>
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('challenges')
      .update(updates)
      .eq('id', challengeId);

    if (error) throw error;
  } catch (error) {
    console.error('챌린지 업데이트 실패:', error);
    throw new Error('챌린지 수정에 실패했습니다.');
  }
};

// 챌린지 삭제
export const deleteChallenge = async (challengeId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId);

    if (error) throw error;
  } catch (error) {
    console.error('챌린지 삭제 실패:', error);
    throw new Error('챌린지 삭제에 실패했습니다.');
  }
};

// ============================================
// One Log, Multi Hit Logic
// ============================================

/**
 * 운동 로그가 저장되었을 때, 자동으로 관련된 모든 챌린지에 기여합니다.
 * @param workoutLogId 운동 기록 ID
 * @returns 업데이트된 챌린지 목록
 */
export const contributeToAllRelevantChallenges = async (
  workoutLogId: string
): Promise<Challenge[]> => {
  try {
    const userId = getCurrentUserId();

    // 1. Get workout log data
    const { data: workoutLog, error: logError } = await supabase
      .from('workout_logs')
      .select(`
        id,
        user_id,
        workouts (
          sets,
          reps,
          weight_kg,
          duration_min
        )
      `)
      .eq('id', workoutLogId)
      .single();

    if (logError) throw logError;

    // 2. Get all active challenges (global + my clubs)
    // 2-1. Global challenges
    const { data: globalChallenges } = await supabase
      .from('challenges')
      .select('*')
      .eq('scope', 'global')
      .eq('status', 'active')
      .lte('start_date', new Date().toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0]);

    // 2-2. My club challenges
    const { data: myClubs } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', userId);

    const clubIds = (myClubs || []).map((m: any) => m.club_id);

    let clubChallenges: any[] = [];
    if (clubIds.length > 0) {
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .eq('scope', 'club')
        .in('club_id', clubIds)
        .eq('status', 'active')
        .lte('start_date', new Date().toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0]);

      clubChallenges = data || [];
    }

    const allChallenges = [...(globalChallenges || []), ...clubChallenges];

    // 3. Calculate contribution for each challenge
    const updatedChallenges: Challenge[] = [];
    const workouts = workoutLog.workouts || [];

    for (const challenge of allChallenges) {
      let contributionValue = 0;

      switch (challenge.goal_metric) {
        case 'total_workouts':
          contributionValue = workouts.length;
          break;
        case 'total_volume':
          contributionValue = workouts.reduce(
            (sum: number, w: any) => sum + ((w.sets || 0) * (w.reps || 0) * (w.weight_kg || 0)),
            0
          );
          break;
        case 'total_duration':
          contributionValue = workouts.reduce((sum: number, w: any) => sum + (w.duration_min || 0), 0);
          break;
        case 'total_distance':
          // distance_km field would be needed
          contributionValue = 0;
          break;
      }

      if (contributionValue === 0) continue;

      // 4. Add contribution record
      const { error: contributionError } = await supabase
        .from('challenge_participants')
        .insert({
          challenge_id: challenge.id,
          user_id: userId,
          workout_log_id: workoutLogId,
          contribution_value: contributionValue,
        });

      if (contributionError) {
        // Already contributed (duplicate), skip
        if (contributionError.code === '23505') continue;
        throw contributionError;
      }

      // 5. Update challenge current_value
      const newValue = (challenge.current_value || 0) + contributionValue;
      const { error: updateError } = await supabase
        .from('challenges')
        .update({ current_value: newValue })
        .eq('id', challenge.id);

      if (!updateError) {
        updatedChallenges.push({ ...challenge, current_value: newValue });
      }
    }

    return updatedChallenges;
  } catch (error) {
    console.error('챌린지 자동 기여 실패:', error);
    // Don't throw - this is a background process
    return [];
  }
};

// 개별 챌린지에 수동 기여 (기존 함수 유지)
export const contributeToChallenge = async (
  challengeId: string,
  workoutLogId: string
): Promise<void> => {
  try {
    const userId = getCurrentUserId();

    // 1. Get workout log
    const { data: workoutLog, error: logError } = await supabase
      .from('workout_logs')
      .select(`
        id,
        workouts (
          sets,
          reps,
          weight_kg,
          duration_min
        )
      `)
      .eq('id', workoutLogId)
      .single();

    if (logError) throw logError;

    // 2. Get challenge type
    const { data: challenge } = await supabase
      .from('challenges')
      .select('goal_metric')
      .eq('id', challengeId)
      .single();

    let contributionValue = 0;
    const workouts = workoutLog.workouts || [];

    switch (challenge?.goal_metric) {
      case 'total_workouts':
        contributionValue = workouts.length;
        break;
      case 'total_volume':
        contributionValue = workouts.reduce(
          (sum: number, w: any) => sum + ((w.sets || 0) * (w.reps || 0) * (w.weight_kg || 0)),
          0
        );
        break;
      case 'total_duration':
        contributionValue = workouts.reduce((sum: number, w: any) => sum + (w.duration_min || 0), 0);
        break;
      case 'total_distance':
        contributionValue = 0;
        break;
    }

    if (contributionValue === 0) {
      throw new Error('기여할 수 있는 값이 없습니다.');
    }

    // 3. Add contribution record
    const { error: contributionError } = await supabase
      .from('challenge_participants')
      .insert({
        challenge_id: challengeId,
        user_id: userId,
        workout_log_id: workoutLogId,
        contribution_value: contributionValue,
      });

    if (contributionError) throw contributionError;

    // 4. Update challenge current_value
    const { data: currentChallenge } = await supabase
      .from('challenges')
      .select('current_value')
      .eq('id', challengeId)
      .single();

    await supabase
      .from('challenges')
      .update({
        current_value: (currentChallenge?.current_value || 0) + contributionValue,
      })
      .eq('id', challengeId);
  } catch (error) {
    console.error('챌린지 기여 실패:', error);
    throw error instanceof Error ? error : new Error('챌린지 기여에 실패했습니다.');
  }
};

// Date formatter (YYYY-MM-DD)
export const formatDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
