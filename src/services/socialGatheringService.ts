import { supabase } from '../lib/supabase';

export interface SocialGathering {
  id: string;
  club_id: string;
  created_by: string;
  description?: string;
  gathered_at: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  members?: GatheringMember[];
  creator_nickname?: string;
}

export interface GatheringMember {
  user_id: string;
  nickname: string;
  profile_image?: string;
}

const socialGatheringService = {
  // 소모임 신청 (대표 회원)
  async createGathering(params: {
    clubId: string;
    createdBy: string;
    memberUserIds: string[];
    description?: string;
    gatheredAt?: string;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('social_gatherings')
      .insert({
        club_id: params.clubId,
        created_by: params.createdBy,
        description: params.description,
        gathered_at: params.gatheredAt ?? new Date().toISOString().split('T')[0],
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    const gatheringId = data.id;
    const allMembers = [...new Set([params.createdBy, ...params.memberUserIds])];

    const memberRows = allMembers.map(userId => ({
      gathering_id: gatheringId,
      user_id: userId,
    }));

    const { error: memberError } = await supabase
      .from('social_gathering_members')
      .insert(memberRows);

    if (memberError) throw memberError;

    return gatheringId;
  },

  // 대기 중인 소모임 목록 (관리자용)
  async getPendingGatherings(clubId: string): Promise<SocialGathering[]> {
    const { data, error } = await supabase
      .from('social_gatherings')
      .select(`
        *,
        social_gathering_members(user_id),
        creator:users!created_by(display_name)
      `)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(row => ({
      ...row,
      creator_nickname: (row as any).creator?.display_name ?? '회원',
      members: ((row as any).social_gathering_members ?? []).map((m: any) => ({
        user_id: m.user_id,
        nickname: '',
        profile_image: undefined,
      })),
    }));
  },

  // 소모임 승인 → 참가자 전원 소셜 포인트 +1 지급
  async approveGathering(gatheringId: string, adminId: string): Promise<void> {
    // 소모임 정보 조회
    const { data: gathering, error: gErr } = await supabase
      .from('social_gatherings')
      .select('*, social_gathering_members(user_id)')
      .eq('id', gatheringId)
      .single();

    if (gErr) throw gErr;

    const memberIds: string[] = ((gathering as any).social_gathering_members ?? []).map((m: any) => m.user_id);

    if (memberIds.length < 3) throw new Error('소모임은 3인 이상이어야 합니다.');

    const gathered = new Date(gathering.gathered_at);
    const year = gathered.getFullYear();
    const month = gathered.getMonth() + 1;

    // 참가자 전원 포인트 지급
    const pointRows = memberIds.map(userId => ({
      club_id: gathering.club_id,
      user_id: userId,
      points: 1,
      action_type: 'gathering',
      description: gathering.description ?? '소모임 인증',
      ref_id: gatheringId,
      awarded_by: adminId,
      year,
      month,
    }));

    const { error: pErr } = await supabase.from('social_points').insert(pointRows);
    if (pErr) throw pErr;

    // 승인 상태 업데이트
    const { error: uErr } = await supabase
      .from('social_gatherings')
      .update({ status: 'approved', approved_by: adminId, approved_at: new Date().toISOString() })
      .eq('id', gatheringId);

    if (uErr) throw uErr;
  },

  // 소모임 거절
  async rejectGathering(gatheringId: string, adminId: string): Promise<void> {
    const { error } = await supabase
      .from('social_gatherings')
      .update({ status: 'rejected', approved_by: adminId, approved_at: new Date().toISOString() })
      .eq('id', gatheringId);
    if (error) throw error;
  },

  // 클럽 회원 닉네임 검색 (소모임 등록 시 참가자 검색용)
  async searchClubMembers(clubId: string, query: string): Promise<GatheringMember[]> {
    const { data, error } = await supabase
      .from('club_members')
      .select('user_id, club_nickname, club_profile_image, users(display_name, profile_image)')
      .eq('club_id', clubId)
      .eq('status', 'active')
      .ilike('club_nickname', `%${query}%`)
      .limit(20);

    if (error) throw error;

    return (data ?? []).map(row => ({
      user_id: row.user_id,
      nickname: row.club_nickname || (row as any).users?.display_name || '회원',
      profile_image: row.club_profile_image || (row as any).users?.profile_image,
    }));
  },

  // 내 소모임 신청 내역
  async getMyGatherings(clubId: string, userId: string): Promise<SocialGathering[]> {
    const { data, error } = await supabase
      .from('social_gathering_members')
      .select('gathering_id, social_gatherings!inner(*, creator:users!created_by(display_name))')
      .eq('social_gatherings.club_id', clubId);

    if (error) throw error;

    return (data ?? [])
      .map((row: any) => ({
        ...row.social_gatherings,
        creator_nickname: row.social_gatherings?.creator?.display_name ?? '회원',
      }))
      .filter((g: any) => g.created_by === userId || true);
  },
};

export default socialGatheringService;
