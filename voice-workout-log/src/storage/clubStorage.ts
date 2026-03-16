import type {
  Club,
  ClubWithMemberInfo,
  ClubDetail,
  ClubMemberWithUser,
  ClubFeedWithDetails,
  ClubChallenge,
  ChallengeDetailWithContributors,
  WorkoutLog,
} from '../types';
import type { HofBadge, SquadMember } from '../utils/dashboardLogic';
import { supabase } from '../lib/supabase';

export interface ClubDashboardData {
  badges: HofBadge[];
  squad: SquadMember[];
  leaderboards: {
    cardio: Array<{ userId: string; displayName: string; profileImage: string | null; value: number }>;
    strength: Array<{ userId: string; displayName: string; profileImage: string | null; value: number }>;
    snowboard: Array<{ userId: string; displayName: string; profileImage: string | null; value: number }>;
  };
}

// Get current user ID from localStorage
const getCurrentUserId = (): string => {
  const userStr = localStorage.getItem('current_user');
  if (!userStr) throw new Error('로그인이 필요합니다.');
  const user = JSON.parse(userStr);
  return user.id;
};

// Date formatter (YYYY-MM-DD)
export const formatDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================
// Club CRUD Functions
// ============================================

export const createClub = async (data: {
  name: string;
  description?: string;
  is_public: boolean;
}): Promise<Club> => {
  try {
    const userId = getCurrentUserId();

    // 1. Create club
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({
        name: data.name,
        description: data.description || null,
        is_public: data.is_public,
        owner_id: userId,
      })
      .select()
      .single();

    if (clubError) throw clubError;

    // 2. Add owner as member
    const { error: memberError } = await supabase
      .from('club_members')
      .insert({
        club_id: club.id,
        user_id: userId,
        role: 'owner',
      });

    if (memberError) throw memberError;

    return club;
  } catch (error) {
    console.error('클럽 생성 실패:', error);
    throw new Error('클럽 생성에 실패했습니다.');
  }
};

export const getMyClubs = async (): Promise<ClubWithMemberInfo[]> => {
  try {
    const userId = getCurrentUserId();

    const { data, error } = await supabase
      .from('club_members')
      .select(`
        id,
        role,
        joined_at,
        clubs (
          id,
          name,
          description,
          is_public,
          invite_code,
          owner_id,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...(item.clubs as Club),
      my_role: item.role,
      joined_at: item.joined_at,
    }));
  } catch (error) {
    console.error('클럽 목록 조회 실패:', error);
    throw new Error('클럽 목록을 불러오는데 실패했습니다.');
  }
};

export const searchPublicClubs = async (query?: string): Promise<Club[]> => {
  try {
    let queryBuilder = supabase
      .from('clubs')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (query && query.trim()) {
      queryBuilder = queryBuilder.ilike('name', `%${query}%`);
    }

    const { data, error } = await queryBuilder;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('공개 클럽 검색 실패:', error);
    throw new Error('클럽 검색에 실패했습니다.');
  }
};

export const getClubByInviteCode = async (inviteCode: string): Promise<Club | null> => {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('클럽 조회 실패:', error);
    throw new Error('클럽을 찾을 수 없습니다.');
  }
};

export const getClubDetail = async (clubId: string): Promise<ClubDetail> => {
  try {
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();

    if (clubError) throw clubError;

    // Get member count
    const { count: memberCount, error: memberError } = await supabase
      .from('club_members')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId);

    if (memberError) throw memberError;

    // Get active challenge count
    const { count: challengeCount, error: challengeError } = await supabase
      .from('club_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('status', 'active');

    if (challengeError) throw challengeError;

    return {
      ...club,
      member_count: memberCount || 0,
      active_challenge_count: challengeCount || 0,
    };
  } catch (error) {
    console.error('클럽 상세 조회 실패:', error);
    throw new Error('클럽 정보를 불러오는데 실패했습니다.');
  }
};

export const updateClub = async (
  clubId: string,
  updates: Partial<Pick<Club, 'name' | 'description' | 'is_public'>>
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('clubs')
      .update(updates)
      .eq('id', clubId);

    if (error) throw error;
  } catch (error) {
    console.error('클럽 업데이트 실패:', error);
    throw new Error('클럽 정보 수정에 실패했습니다.');
  }
};

export const deleteClub = async (clubId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('id', clubId);

    if (error) throw error;
  } catch (error) {
    console.error('클럽 삭제 실패:', error);
    throw new Error('클럽 삭제에 실패했습니다.');
  }
};

// Update dashboard widget configuration
export const updateDashboardConfig = async (
  clubId: string,
  dashboardConfig: any
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('clubs')
      .update({ dashboard_config: dashboardConfig })
      .eq('id', clubId);

    if (error) throw error;
  } catch (error) {
    console.error('대시보드 설정 업데이트 실패:', error);
    throw new Error('대시보드 설정 업데이트에 실패했습니다.');
  }
};

// ============================================
// Member Management Functions
// ============================================

export const joinClub = async (clubId: string): Promise<void> => {
  try {
    const userId = getCurrentUserId();

    // Check if already joined
    const { data: existing } = await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      throw new Error('이미 가입한 클럽입니다.');
    }

    const { error } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        user_id: userId,
        role: 'member',
      });

    if (error) throw error;
  } catch (error) {
    console.error('클럽 가입 실패:', error);
    throw error instanceof Error ? error : new Error('클럽 가입에 실패했습니다.');
  }
};

export const leaveClub = async (clubId: string): Promise<void> => {
  try {
    const userId = getCurrentUserId();

    // Check if owner
    const { data: membership } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .single();

    if (membership?.role === 'owner') {
      throw new Error('클럽 소유자는 탈퇴할 수 없습니다. 클럽을 삭제해주세요.');
    }

    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('클럽 탈퇴 실패:', error);
    throw error instanceof Error ? error : new Error('클럽 탈퇴에 실패했습니다.');
  }
};

export const getClubMembers = async (clubId: string): Promise<ClubMemberWithUser[]> => {
  try {
    const { data, error } = await supabase
      .from('club_members')
      .select(`
        id,
        role,
        joined_at,
        club_id,
        user_id,
        users (
          id,
          username,
          display_name,
          profile_image
        )
      `)
      .eq('club_id', clubId)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      club_id: item.club_id,
      user_id: item.user_id,
      role: item.role,
      joined_at: item.joined_at,
      user: item.users,
    }));
  } catch (error) {
    console.error('멤버 목록 조회 실패:', error);
    throw new Error('멤버 목록을 불러오는데 실패했습니다.');
  }
};

export const updateMemberRole = async (
  memberId: string,
  newRole: 'admin' | 'member'
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('club_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) throw error;
  } catch (error) {
    console.error('역할 변경 실패:', error);
    throw new Error('멤버 역할 변경에 실패했습니다.');
  }
};

export const removeMember = async (memberId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  } catch (error) {
    console.error('멤버 퇴출 실패:', error);
    throw new Error('멤버 퇴출에 실패했습니다.');
  }
};

// ============================================
// Feed Management Functions
// ============================================

export const shareWorkoutToClub = async (
  clubId: string,
  workoutLogId: string
): Promise<void> => {
  try {
    const userId = getCurrentUserId();

    const { error } = await supabase
      .from('club_feeds')
      .insert({
        club_id: clubId,
        user_id: userId,
        workout_log_id: workoutLogId,
      });

    if (error) throw error;
  } catch (error) {
    console.error('운동 공유 실패:', error);
    throw new Error('운동 기록 공유에 실패했습니다.');
  }
};

export const getClubFeeds = async (
  clubId: string,
  limit: number = 20,
  offset: number = 0
): Promise<ClubFeedWithDetails[]> => {
  try {
    const { data, error } = await supabase
      .from('club_feeds')
      .select(`
        id,
        shared_at,
        users!club_feeds_user_id_fkey (
          id,
          username,
          display_name,
          profile_image
        ),
        workout_logs (
          id,
          date,
          raw_text,
          normalized_text,
          memo,
          created_at,
          workouts (
            id,
            name,
            type,
            sets,
            reps,
            weight_kg,
            duration_min,
            note
          )
        )
      `)
      .eq('club_id', clubId)
      .order('shared_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      club_id: clubId,
      shared_at: item.shared_at,
      user: item.users,
      workout_log: {
        id: item.workout_logs.id,
        date: item.workout_logs.date,
        rawText: item.workout_logs.raw_text,
        normalizedText: item.workout_logs.normalized_text || '',
        memo: item.workout_logs.memo,
        createdAt: new Date(item.workout_logs.created_at).getTime(),
        workouts: item.workout_logs.workouts.map((w: any) => ({
          name: w.name,
          type: w.type,
          sets: w.sets,
          reps: w.reps,
          weight_kg: w.weight_kg,
          duration_min: w.duration_min,
          distance_km: null,
          pace: null,
          note: w.note,
        })),
      },
    }));
  } catch (error) {
    console.error('피드 조회 실패:', error);
    throw new Error('피드를 불러오는데 실패했습니다.');
  }
};

export const unshareWorkout = async (feedId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('club_feeds')
      .delete()
      .eq('id', feedId);

    if (error) throw error;
  } catch (error) {
    console.error('공유 취소 실패:', error);
    throw new Error('공유 취소에 실패했습니다.');
  }
};

// ============================================
// Challenge Functions
// ============================================

export const createChallenge = async (data: {
  club_id: string;
  title: string;
  description?: string;
  rules: any; // ChallengeRules JSONB
  start_date: string;
  end_date: string;
  theme_color?: string;
}): Promise<ClubChallenge> => {
  try {
    const userId = getCurrentUserId();

    const { data: challenge, error } = await supabase
      .from('challenges')
      .insert({
        scope: 'club',
        club_id: data.club_id,
        title: data.title,
        description: data.description,
        rules: data.rules,
        goal_metric: 'custom',
        goal_value: data.rules.goal_value,
        current_value: 0,
        start_date: data.start_date,
        end_date: data.end_date,
        theme_color: data.theme_color,
        status: 'active',
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

export const getActiveChallenges = async (clubId: string): Promise<ClubChallenge[]> => {
  try {
    const { data, error } = await supabase
      .from('club_challenges')
      .select('*')
      .eq('club_id', clubId)
      .eq('status', 'active')
      .order('end_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('챌린지 목록 조회 실패:', error);
    throw new Error('챌린지 목록을 불러오는데 실패했습니다.');
  }
};

export const getAllChallenges = async (
  clubId: string,
  statusFilter?: 'active' | 'completed' | 'failed'
): Promise<ClubChallenge[]> => {
  try {
    let query = supabase
      .from('club_challenges')
      .select('*')
      .eq('club_id', clubId);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('전체 챌린지 조회 실패:', error);
    throw new Error('챌린지 목록을 불러오는데 실패했습니다.');
  }
};

export const getChallengeDetail = async (
  challengeId: string
): Promise<ChallengeDetailWithContributors> => {
  try {
    // 1. Get challenge info
    const { data: challenge, error: challengeError } = await supabase
      .from('club_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError) throw challengeError;

    // 2. Get contributor rankings
    const { data: contributions, error: contributionError } = await supabase
      .from('challenge_contributions')
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
      contributors,
    };
  } catch (error) {
    console.error('챌린지 상세 조회 실패:', error);
    throw new Error('챌린지 정보를 불러오는데 실패했습니다.');
  }
};

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
      .from('club_challenges')
      .select('challenge_type')
      .eq('id', challengeId)
      .single();

    let contributionValue = 0;
    const workouts = workoutLog.workouts || [];

    switch (challenge?.challenge_type) {
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

    if (contributionValue === 0) {
      throw new Error('기여할 수 있는 값이 없습니다.');
    }

    // 3. Add contribution record
    const { error: contributionError } = await supabase
      .from('challenge_contributions')
      .insert({
        challenge_id: challengeId,
        user_id: userId,
        workout_log_id: workoutLogId,
        contribution_value: contributionValue,
      });

    if (contributionError) throw contributionError;

    // 4. Update challenge current_value
    const { error: updateError } = await supabase.rpc('increment_challenge_value', {
      p_challenge_id: challengeId,
      p_increment: contributionValue,
    });

    if (updateError) {
      // Fallback: direct update if RPC function doesn't exist
      const { data: currentChallenge } = await supabase
        .from('club_challenges')
        .select('current_value')
        .eq('id', challengeId)
        .single();

      await supabase
        .from('club_challenges')
        .update({
          current_value: (currentChallenge?.current_value || 0) + contributionValue,
        })
        .eq('id', challengeId);
    }
  } catch (error) {
    console.error('챌린지 기여 실패:', error);
    throw error instanceof Error ? error : new Error('챌린지 기여에 실패했습니다.');
  }
};

export const updateChallenge = async (
  challengeId: string,
  updates: Partial<Pick<ClubChallenge, 'title' | 'description' | 'status'>>
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('club_challenges')
      .update(updates)
      .eq('id', challengeId);

    if (error) throw error;
  } catch (error) {
    console.error('챌린지 업데이트 실패:', error);
    throw new Error('챌린지 수정에 실패했습니다.');
  }
};

export const deleteChallenge = async (challengeId: string): Promise<void> => {
  try {
    const { error} = await supabase
      .from('club_challenges')
      .delete()
      .eq('id', challengeId);

    if (error) throw error;
  } catch (error) {
    console.error('챌린지 삭제 실패:', error);
    throw new Error('챌린지 삭제에 실패했습니다.');
  }
};

// ============================================
// Club Dashboard (Server-Side Aggregation)
// ============================================

/**
 * 클럽 대시보드 데이터 조회 (DB에서 집계)
 * 배지, 스쿼드, 리더보드를 DB Function에서 계산하여 반환
 */
export const getClubDashboard = async (clubId: string): Promise<ClubDashboardData> => {
  try {
    const userStr = localStorage.getItem('current_user');
    const currentUserId = userStr ? JSON.parse(userStr).id : null;

    const { data, error } = await supabase.rpc('get_club_dashboard', {
      p_club_id: clubId,
      p_current_user_id: currentUserId,
    });

    if (error) throw error;

    return {
      badges: data.badges || [],
      squad: data.squad || [],
      leaderboards: data.leaderboards || { cardio: [], strength: [], snowboard: [] },
    };
  } catch (error) {
    console.error('클럽 대시보드 조회 실패:', error);
    throw new Error('클럽 대시보드를 불러오는데 실패했습니다.');
  }
};

// ============================================
// Club Member Workout Logs (Zero-Copy View Architecture)
// ============================================

/**
 * 클럽 멤버들의 공개 운동 로그 조회
 * Zero-Copy View Architecture: club_feeds 테이블을 사용하지 않고,
 * RLS를 통해 workout_logs를 직접 조회
 *
 * @deprecated 대시보드는 getClubDashboard() 사용 권장
 */
export const getClubMemberLogs = async (
  clubId: string,
  limit: number = 20,
  offset: number = 0
): Promise<WorkoutLog[]> => {
  try {
    // 1. Get club member user_ids
    const { data: members, error: membersError } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId);

    if (membersError) throw membersError;
    if (!members || members.length === 0) return [];

    const memberUserIds = members.map((m: any) => m.user_id);

    // 2. Get public workout logs from these members
    // RLS will automatically filter to only show logs from users in the same club
    const { data: logs, error: logsError } = await supabase
      .from('workout_logs')
      .select(`
        id,
        user_id,
        date,
        raw_text,
        normalized_text,
        memo,
        is_private,
        created_at,
        workouts (
          id,
          name,
          category,
          type,
          sets,
          reps,
          weight_kg,
          duration_min,
          note
        ),
        users (
          display_name,
          profile_image
        )
      `)
      .in('user_id', memberUserIds)
      .eq('is_private', false) // Only public logs
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (logsError) throw logsError;

    return (logs || []).map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      date: log.date,
      rawText: log.raw_text,
      normalizedText: log.normalized_text || '',
      workouts: (log.workouts || []).map((w: any) => ({
        name: w.name,
        category: w.category || 'gym',
        type: w.type,
        sets: w.sets,
        reps: w.reps,
        weight_kg: w.weight_kg,
        duration_min: w.duration_min,
        distance_km: null,
        pace: null,
        note: w.note,
      })),
      memo: log.memo,
      createdAt: new Date(log.created_at).getTime(),
      isPrivate: log.is_private ?? false,
      // User info for display
      userDisplayName: log.users?.display_name || '익명',
      userProfileImage: log.users?.profile_image || null,
    }));
  } catch (error) {
    console.error('클럽 멤버 로그 조회 실패:', error);
    throw error instanceof Error ? error : new Error('클럽 멤버 로그 조회에 실패했습니다.');
  }
};
