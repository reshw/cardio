import { supabase } from '../lib/supabase';

export type SocialActionType = 'share' | 'gathering' | 'cafe_post' | 'referral' | 'training' | 'donation';

export interface SocialPoint {
  id: string;
  club_id: string;
  user_id: string;
  points: number;
  action_type: SocialActionType;
  description?: string;
  memo_url?: string;
  ref_id?: string;
  awarded_by?: string;
  year: number;
  month: number;
  created_at: string;
}

export interface SocialLeaderboardEntry {
  user_id: string;
  nickname: string;
  profile_image?: string;
  total_points: number;
  rank: number;
}

export interface SocialMyStats {
  total_points: number;
  rank: number;
  history: SocialPointHistory[];
}

export interface SocialPointHistory {
  id: string;
  action_type: SocialActionType;
  points: number;
  description?: string;
  memo_url?: string;
  created_at: string;
}

const ACTION_LABELS: Record<SocialActionType, string> = {
  share: '기록 공유',
  gathering: '소모임 인증',
  cafe_post: '카페 글 작성',
  referral: '신규 초대',
  training: '훈련 참가',
  donation: '기부금',
};

const ACTION_ICONS: Record<SocialActionType, string> = {
  share: '📤',
  gathering: '🤝',
  cafe_post: '✍️',
  referral: '👥',
  training: '🏃',
  donation: '💰',
};

export const getActionLabel = (type: SocialActionType) => ACTION_LABELS[type] ?? type;
export const getActionIcon = (type: SocialActionType) => ACTION_ICONS[type] ?? '⭐';

const socialPointService = {
  // 카톡 공유 자동 적립 (하루 1회 제한)
  async addSharePoint(clubId: string, userId: string): Promise<boolean> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { error } = await supabase.from('social_points').insert({
      club_id: clubId,
      user_id: userId,
      points: 1,
      action_type: 'share',
      year,
      month,
    });

    // unique constraint 위반 = 오늘 이미 공유함 → 조용히 무시
    if (error && error.code === '23505') return false;
    if (error) throw error;
    return true;
  },

  // 운영진 수동 포인트 지급
  async awardPoints(params: {
    adminId: string;
    clubId: string;
    userId: string;
    actionType: SocialActionType;
    points: number;
    description?: string;
    memoUrl?: string;
    refId?: string;
    date?: Date;
  }): Promise<void> {
    const d = params.date ?? new Date();
    const { error } = await supabase.from('social_points').insert({
      club_id: params.clubId,
      user_id: params.userId,
      points: params.points,
      action_type: params.actionType,
      description: params.description,
      memo_url: params.memoUrl,
      ref_id: params.refId,
      awarded_by: params.adminId,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
    if (error) throw error;
  },

  // 훈련 참가 일괄 지급
  async awardBulkTraining(params: {
    adminId: string;
    clubId: string;
    userIds: string[];
    description?: string;
    date?: Date;
  }): Promise<void> {
    const d = params.date ?? new Date();
    const rows = params.userIds.map(userId => ({
      club_id: params.clubId,
      user_id: userId,
      points: 5,
      action_type: 'training' as SocialActionType,
      description: params.description,
      awarded_by: params.adminId,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    }));
    const { error } = await supabase.from('social_points').insert(rows);
    if (error) throw error;
  },

  // 월별 리더보드
  async getMonthlyLeaderboard(clubId: string, year: number, month: number): Promise<SocialLeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('social_points')
      .select('user_id, points, club_members!inner(club_nickname, club_profile_image, users(profile_image))')
      .eq('club_id', clubId)
      .eq('year', year)
      .eq('month', month);

    if (error) throw error;

    const totals: Record<string, { points: number; nickname: string; profile_image?: string }> = {};
    for (const row of data ?? []) {
      const member = (row as any).club_members;
      const nickname = member?.club_nickname || (member?.users as any)?.display_name || '회원';
      const profile_image = member?.club_profile_image || (member?.users as any)?.profile_image;
      if (!totals[row.user_id]) {
        totals[row.user_id] = { points: 0, nickname, profile_image };
      }
      totals[row.user_id].points += row.points;
    }

    return Object.entries(totals)
      .map(([user_id, v]) => ({ user_id, ...v, total_points: v.points, rank: 0 }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
  },

  // 내 월별 내역 + 순위
  async getMyStats(clubId: string, userId: string, year: number, month: number): Promise<SocialMyStats> {
    const { data, error } = await supabase
      .from('social_points')
      .select('id, action_type, points, description, memo_url, created_at')
      .eq('club_id', clubId)
      .eq('year', year)
      .eq('month', month)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const allRows = data ?? [];

    // 내 포인트 합산
    const { data: myData, error: myError } = await supabase
      .from('social_points')
      .select('id, action_type, points, description, memo_url, created_at')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .order('created_at', { ascending: false });

    if (myError) throw myError;

    const myPoints = (myData ?? []).reduce((s, r) => s + r.points, 0);

    // 전체 합산으로 내 순위 계산
    const totals: Record<string, number> = {};
    for (const row of allRows) {
      const uid = (row as any).user_id;
      if (uid) totals[uid] = (totals[uid] ?? 0) + row.points;
    }

    // user_id 포함해서 다시 조회
    const { data: allWithUser, error: allErr } = await supabase
      .from('social_points')
      .select('user_id, points')
      .eq('club_id', clubId)
      .eq('year', year)
      .eq('month', month);

    if (allErr) throw allErr;

    const totals2: Record<string, number> = {};
    for (const row of allWithUser ?? []) {
      totals2[row.user_id] = (totals2[row.user_id] ?? 0) + row.points;
    }
    const sorted = Object.values(totals2).sort((a, b) => b - a);
    const myRankPoints = totals2[userId] ?? 0;
    const rank = sorted.findIndex(p => p <= myRankPoints) + 1;

    return {
      total_points: myPoints,
      rank: rank || 1,
      history: myData ?? [],
    };
  },

  // 포인트 항목 삭제 (운영진)
  async deletePoint(pointId: string): Promise<void> {
    const { error } = await supabase.from('social_points').delete().eq('id', pointId);
    if (error) throw error;
  },
};

export default socialPointService;
