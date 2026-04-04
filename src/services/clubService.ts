import { supabase } from '../lib/supabase';
import userService from './userService';
import { sendClubRequestEmail } from '../utils/email';

export interface Club {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  invite_code: string;
  mileage_config: MileageConfig;
  enabled_categories?: string[];
  logo_url?: string;
  member_count?: number;
  is_member?: boolean;
  status?: 'pending' | 'active' | 'closed';
  rejection_reason?: string;
  approved_at?: string;
  approved_by?: string;
  count_excluded_workouts_in_days?: boolean; // 미산입 운동도 운동일수에 포함할지 여부
}

// 동적 마일리지 설정 (모든 운동 종목 지원)
export type MileageConfig = Record<string, number>;

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'manager' | 'vice-manager' | 'member';
  joined_at: string;
  display_order: number;
  club_nickname?: string;
  club_profile_image?: string;
  show_in_feed?: boolean;
  show_mileage?: boolean;
  is_hall_of_fame?: boolean;  // 명예의 전당 여부 (조인 결과)
  hof_inducted_at?: string;    // 명예의 전당 등재일 (조인 결과)
  user?: {
    display_name: string;
    profile_image?: string;
  };
}

export interface HallOfFame {
  id: string;
  club_id: string;
  user_id: string;
  inducted_at: string;
  inducted_by?: string;
  reason?: string;
  created_at: string;
}

export interface MyClubWithOrder extends Club {
  display_order: number;
  member_id: string;
  role: 'manager' | 'vice-manager' | 'member';
}

export interface ClubRanking {
  user_id: string;
  display_name: string;
  profile_image?: string;
  total_mileage: number;
  workout_count: number;
  rank: number;
  is_hall_of_fame?: boolean;  // 명예의 전당 여부
  hof_reason?: string;  // 명예의 전당 사유
}

export interface ClubWorkoutMileage {
  id: string;
  club_id: string;
  workout_id: string;
  user_id: string;
  mileage: number;
  year: number;
  month: number;
  calculated_at: string;
  mileage_config_snapshot?: MileageConfig;
}

export interface ClubDetailedStats {
  user_id: string;
  display_name: string;
  rank: number;
  total_mileage: number;
  workout_days: number; // 운동일수
  by_workout: Record<string, number>; // 동적 운동 종목 지원 (마일리지)
  by_workout_values: Record<string, number>; // 실제 운동 기록 값
  by_workout_units: Record<string, string>; // 운동 종목별 단위
  is_hall_of_fame?: boolean; // 명예의 전당 여부
  joined_at?: string;        // 클럽 가입일
}

class ClubService {
  // 초대 코드 생성 (중복 방지)
  private async generateUniqueInviteCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 제외 (I, O, 0, 1)
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 6자리 랜덤 코드 생성
      let code = '';
      for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
      }

      // 중복 확인
      const { data: existing, error } = await supabase
        .from('clubs')
        .select('id')
        .eq('invite_code', code)
        .maybeSingle();

      // 에러 무시 (테이블에 컬럼이 없을 수도 있음)
      if (error && error.code !== 'PGRST116') {
        console.warn('초대 코드 중복 확인 실패:', error);
        continue;
      }

      // 중복되지 않으면 반환
      if (!existing) {
        return code;
      }
    }

    // 최대 시도 횟수 초과 시 타임스탬프 포함
    const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
    return timestamp + chars.slice(0, 2);
  }

  // 클럽 생성
  async createClub(data: {
    name: string;
    description: string;
    created_by: string;
    club_nickname?: string;
    club_profile_image?: string;
  }): Promise<Club> {
    console.log('🏢 클럽 생성 시작:', data);

    // 고유한 초대 코드 생성
    const inviteCode = await this.generateUniqueInviteCode();
    console.log('🎫 생성된 초대 코드:', inviteCode);

    const { data: club, error } = await supabase
      .from('clubs')
      .insert({
        name: data.name,
        description: data.description,
        created_by: data.created_by,
        invite_code: inviteCode,
        status: 'pending', // 어드민 승인 대기
        enabled_categories: this.getDefaultEnabledCategories(),
        mileage_config: await this.getDefaultMileageConfig(), // 전체 계수 명시적 설정
      })
      .select()
      .single();

    if (error) {
      console.error('❌ 클럽 생성 실패:', error);
      throw new Error(`클럽 생성 실패: ${error.message}`);
    }

    console.log('✅ 클럽 생성 성공:', club);

    // 생성자를 manager로 자동 가입
    await this.joinClub(club.id, data.created_by, 'manager', data.club_nickname, data.club_profile_image);

    // 어드민에게 이메일 발송 (비동기, 실패해도 클럽 생성은 성공)
    this.sendClubRequestNotification(club, data.created_by).catch((error) => {
      console.error('⚠️  어드민 이메일 발송 실패 (클럽 생성은 성공):', error);
    });

    return club;
  }

  // 초대 코드로 클럽 찾기
  async findClubByInviteCode(inviteCode: string): Promise<Club | null> {
    const { data: club, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('invite_code', inviteCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('클럽 조회 실패:', error);
      throw error;
    }

    return club;
  }

  // 초대 코드로 클럽 정보 미리보기 (방장 정보 포함)
  async getClubPreviewByInviteCode(inviteCode: string): Promise<{
    club: Club;
    ownerName: string;
  } | null> {
    const { data: club, error } = await supabase
      .from('clubs')
      .select(`
        *,
        owner:users!clubs_created_by_fkey(display_name)
      `)
      .eq('invite_code', inviteCode)
      .eq('status', 'active')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('클럽 미리보기 조회 실패:', error);
      throw error;
    }

    if (!club) return null;

    // 방장 club_nickname 조회
    const { data: ownerMember, error: memberError } = await supabase
      .from('club_members')
      .select('club_nickname')
      .eq('club_id', club.id)
      .eq('user_id', club.created_by)
      .eq('role', 'manager')
      .maybeSingle();

    if (memberError && memberError.code !== 'PGRST116') {
      console.error('방장 닉네임 조회 실패:', memberError);
    }

    const ownerName = ownerMember?.club_nickname || (club.owner as any)?.display_name || '알 수 없음';

    return {
      club,
      ownerName,
    };
  }

  // 초대 코드로 클럽 가입
  async joinClubByInviteCode(inviteCode: string, userId: string, clubNickname?: string, clubProfileImage?: string): Promise<Club> {
    const club = await this.findClubByInviteCode(inviteCode);

    if (!club) {
      throw new Error('존재하지 않는 초대 코드입니다.');
    }

    // 이미 가입했는지 확인
    const isMember = await this.isClubMember(club.id, userId);
    if (isMember) {
      throw new Error('이미 가입한 클럽입니다.');
    }

    await this.joinClub(club.id, userId, 'member', clubNickname, clubProfileImage);
    return club;
  }

  // 모든 클럽 조회
  async getAllClubs(userId?: string): Promise<Club[]> {
    let query = supabase.from('clubs').select('*').order('created_at', { ascending: false });

    const { data: clubs, error } = await query;

    if (error) {
      console.error('클럽 목록 조회 실패:', error);
      throw error;
    }

    // 각 클럽의 멤버 수와 가입 여부 조회
    if (userId) {
      const clubsWithInfo = await Promise.all(
        (clubs || []).map(async (club) => {
          const memberCount = await this.getClubMemberCount(club.id);
          const isMember = await this.isClubMember(club.id, userId);
          return { ...club, member_count: memberCount, is_member: isMember };
        })
      );
      return clubsWithInfo;
    }

    return clubs || [];
  }

  // 내가 가입한 클럽 조회 (순서 포함)
  async getMyClubs(userId: string): Promise<MyClubWithOrder[]> {
    const { data: members, error } = await supabase
      .from('club_members')
      .select('id, club_id, display_order, role')
      .eq('user_id', userId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('내 클럽 조회 실패:', error);
      throw error;
    }

    if (!members || members.length === 0) return [];

    const clubIds = members.map((m) => m.club_id);

    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('*')
      .in('id', clubIds);

    if (clubsError) {
      console.error('클럽 정보 조회 실패:', clubsError);
      throw clubsError;
    }

    // 클럽 정보와 순서 정보 병합
    // active 클럽 또는 자신이 만든 pending 클럽만 표시
    const clubsWithOrder: MyClubWithOrder[] = members
      .map((member) => {
        const club = clubs?.find((c) => c.id === member.club_id);
        if (!club) return null;

        // active 클럽이거나, 자신이 만든 pending 클럽만 표시
        const isActive = !club.status || club.status === 'active';
        const isPendingOwner = club.status === 'pending' && club.created_by === userId;

        if (isActive || isPendingOwner) {
          return {
            ...club,
            display_order: member.display_order,
            member_id: member.id,
            role: member.role,
          };
        }
        return null;
      })
      .filter((c): c is MyClubWithOrder => c !== null);

    return clubsWithOrder;
  }

  // 클럽 순서 변경
  async updateClubOrder(userId: string, clubOrders: { club_id: string; order: number }[]): Promise<void> {
    const updates = clubOrders.map((item) =>
      supabase
        .from('club_members')
        .update({ display_order: item.order })
        .eq('user_id', userId)
        .eq('club_id', item.club_id)
    );

    const results = await Promise.all(updates);

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('클럽 순서 변경 실패:', errors);
      throw new Error('클럽 순서 변경에 실패했습니다.');
    }
  }

  // 클럽 상세 조회
  async getClubById(clubId: string): Promise<Club> {
    const { data: club, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', clubId)
      .single();

    if (error) {
      console.error('클럽 조회 실패:', error);
      throw error;
    }

    // 마일리지 계수 자동 보정 (없는 항목은 기본값으로 설정)
    if (club) {
      club.mileage_config = await this.normalizeMileageConfig(club.mileage_config);
    }

    return club;
  }

  // 클럽 정보 수정
  async updateClub(
    clubId: string,
    data: { name?: string; description?: string; mileage_config?: MileageConfig; logo_url?: string; enabled_categories?: string[] }
  ): Promise<Club> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.mileage_config !== undefined) updateData.mileage_config = data.mileage_config;
    if (data.logo_url !== undefined) updateData.logo_url = data.logo_url;
    if (data.enabled_categories !== undefined) updateData.enabled_categories = data.enabled_categories;

    const { data: club, error } = await supabase
      .from('clubs')
      .update(updateData)
      .eq('id', clubId)
      .select()
      .single();

    if (error) {
      console.error('클럽 수정 실패:', error);
      throw error;
    }

    return club;
  }

  // 클럽 삭제
  async deleteClub(clubId: string): Promise<void> {
    const { error } = await supabase.from('clubs').delete().eq('id', clubId);

    if (error) {
      console.error('클럽 삭제 실패:', error);
      throw error;
    }
  }

  // 사용자가 클럽의 admin인지 확인 (owner 포함)
  async isClubAdmin(clubId: string, userId: string): Promise<boolean> {
    // 1. 클럽 생성자(owner)인지 확인
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('created_by')
      .eq('id', clubId)
      .maybeSingle();

    if (!clubError && club && club.created_by === userId) {
      return true; // Owner
    }

    // 2. club_members에서 admin 권한 확인
    const { data, error } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('권한 확인 실패:', error);
      return false;
    }

    return data?.role === 'manager' || data?.role === 'vice-manager';
  }

  // 클럽 가입
  async joinClub(clubId: string, userId: string, role: 'manager' | 'vice-manager' | 'member' = 'member', clubNickname?: string, clubProfileImage?: string): Promise<void> {
    const { error } = await supabase.from('club_members').insert({
      club_id: clubId,
      user_id: userId,
      role,
      club_nickname: clubNickname,
      club_profile_image: clubProfileImage,
    });

    if (error) {
      console.error('클럽 가입 실패:', error);
      throw error;
    }
  }

  // 클럽 탈퇴
  async leaveClub(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('클럽 탈퇴 실패:', error);
      throw error;
    }
  }

  // 클럽 닉네임 업데이트
  async updateClubNickname(clubId: string, userId: string, nickname: string, changedBy?: string): Promise<void> {
    // 변경 전 현재 닉네임 조회
    const { data: current } = await supabase
      .from('club_members')
      .select('club_nickname')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .single();

    const { error } = await supabase
      .from('club_members')
      .update({ club_nickname: nickname })
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('클럽 닉네임 업데이트 실패:', error);
      throw error;
    }

    // 닉네임이 실제로 변경된 경우만 이력 기록
    if (current?.club_nickname !== nickname) {
      await supabase.from('club_nickname_history').insert({
        club_id: clubId,
        user_id: userId,
        old_nickname: current?.club_nickname ?? null,
        new_nickname: nickname,
        changed_by: changedBy ?? userId,
      });
    }
  }

  // 클럽 멤버 프로필 조회 (별명 + 프로필 이미지)
  async getClubMemberProfile(
    clubId: string,
    userId: string
  ): Promise<{ club_nickname: string | null; club_profile_image: string | null }> {
    const { data, error } = await supabase
      .from('club_members')
      .select('club_nickname, club_profile_image')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('클럽 멤버 프로필 조회 실패:', error);
      return { club_nickname: null, club_profile_image: null };
    }

    return {
      club_nickname: data?.club_nickname || null,
      club_profile_image: data?.club_profile_image || null,
    };
  }

  // 클럽 멤버 프로필 업데이트 (별명 + 프로필 이미지)
  async updateClubMemberProfile(
    clubId: string,
    userId: string,
    profile: { club_nickname?: string; club_profile_image?: string | null },
    changedBy?: string
  ): Promise<void> {
    // 닉네임 변경이 포함된 경우 이력용으로 현재값 조회
    let currentNickname: string | null = null;
    if (profile.club_nickname !== undefined) {
      const { data: current } = await supabase
        .from('club_members')
        .select('club_nickname')
        .eq('club_id', clubId)
        .eq('user_id', userId)
        .single();
      currentNickname = current?.club_nickname ?? null;
    }

    const updateData: any = {};
    if (profile.club_nickname !== undefined) updateData.club_nickname = profile.club_nickname;
    if (profile.club_profile_image !== undefined) updateData.club_profile_image = profile.club_profile_image;

    const { error } = await supabase
      .from('club_members')
      .update(updateData)
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('클럽 멤버 프로필 업데이트 실패:', error);
      throw error;
    }

    // 닉네임이 실제로 변경된 경우만 이력 기록
    if (profile.club_nickname !== undefined && currentNickname !== profile.club_nickname) {
      await supabase.from('club_nickname_history').insert({
        club_id: clubId,
        user_id: userId,
        old_nickname: currentNickname,
        new_nickname: profile.club_nickname,
        changed_by: changedBy ?? userId,
      });
    }
  }

  // 클럽 닉네임 조회
  async getClubNickname(clubId: string, userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('club_members')
      .select('club_nickname')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('클럽 닉네임 조회 실패:', error);
      return null;
    }

    return data?.club_nickname || null;
  }

  // 클럽 멤버 목록 조회
  async getClubMembers(clubId: string): Promise<ClubMember[]> {
    const { data: members, error } = await supabase
      .from('club_members')
      .select('id, club_id, user_id, role, joined_at, display_order, club_nickname, club_profile_image')
      .eq('club_id', clubId);

    if (error) {
      console.error('클럽 멤버 조회 실패:', error);
      throw error;
    }

    if (!members || members.length === 0) {
      return [];
    }

    const userIds = members.map((m) => m.user_id);

    // 사용자 정보 조회
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, profile_image')
      .in('id', userIds);

    // 명예의 전당 멤버 조회
    const { data: hofMembers } = await supabase
      .from('hall_of_fame')
      .select('user_id, inducted_at')
      .eq('club_id', clubId)
      .in('user_id', userIds);

    // HOF 맵 생성
    const hofMap = new Map(hofMembers?.map((h) => [h.user_id, h.inducted_at]) || []);

    // 멤버와 사용자 정보 병합
    return members.map((member) => {
      const user = users?.find((u) => u.id === member.user_id);
      const hofInductedAt = hofMap.get(member.user_id);

      return {
        ...member,
        is_hall_of_fame: !!hofInductedAt,
        hof_inducted_at: hofInductedAt,
        user: user
          ? {
              display_name: user.display_name,
              profile_image: user.profile_image,
            }
          : undefined,
      };
    });
  }

  // 클럽장 위임
  async transferClubOwnership(clubId: string, currentOwnerId: string, newOwnerId: string): Promise<void> {
    // 트랜잭션처럼 처리: 현재 관리자를 멤버로, 새 관리자를 manager로 변경
    const { error: currentOwnerError } = await supabase
      .from('club_members')
      .update({ role: 'member' })
      .eq('club_id', clubId)
      .eq('user_id', currentOwnerId);

    if (currentOwnerError) {
      console.error('현재 관리자 권한 해제 실패:', currentOwnerError);
      throw currentOwnerError;
    }

    const { error: newOwnerError } = await supabase
      .from('club_members')
      .update({ role: 'manager' })
      .eq('club_id', clubId)
      .eq('user_id', newOwnerId);

    if (newOwnerError) {
      console.error('새 관리자 권한 부여 실패:', newOwnerError);
      // 롤백: 현재 관리자 권한 복구
      await supabase
        .from('club_members')
        .update({ role: 'manager' })
        .eq('club_id', clubId)
        .eq('user_id', currentOwnerId);
      throw newOwnerError;
    }

    // clubs 테이블의 created_by 업데이트
    const { error: clubError } = await supabase
      .from('clubs')
      .update({ created_by: newOwnerId })
      .eq('id', clubId);

    if (clubError) {
      console.error('클럽 소유자 업데이트 실패:', clubError);
      // 롤백
      await supabase
        .from('club_members')
        .update({ role: 'manager' })
        .eq('club_id', clubId)
        .eq('user_id', currentOwnerId);
      await supabase
        .from('club_members')
        .update({ role: 'member' })
        .eq('club_id', clubId)
        .eq('user_id', newOwnerId);
      throw clubError;
    }
  }

  // 회원 역할 변경 (부매니저 지정/해제)
  async updateMemberRole(clubId: string, userId: string, role: 'manager' | 'vice-manager' | 'member'): Promise<void> {
    const { error } = await supabase
      .from('club_members')
      .update({ role })
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('회원 역할 변경 실패:', error);
      throw error;
    }
  }

  // 회원 내보내기
  async removeMember(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('회원 내보내기 실패:', error);
      throw error;
    }
  }

  // 클럽 멤버 여부 확인
  async isClubMember(clubId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('club_members')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('멤버 확인 실패:', error);
      return false;
    }

    return !!data;
  }

  // 클럽 멤버 수 조회
  async getClubMemberCount(clubId: string): Promise<number> {
    const { count, error } = await supabase
      .from('club_members')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId);

    if (error) {
      console.error('멤버 수 조회 실패:', error);
      return 0;
    }

    return count || 0;
  }

  // 월별 마일리지 설정 스냅샷 저장
  async saveMonthlyConfigSnapshot(
    clubId: string,
    year: number,
    month: number,
    config: MileageConfig
  ): Promise<void> {
    const { error } = await supabase
      .from('club_monthly_configs')
      .upsert({
        club_id: clubId,
        year,
        month,
        mileage_config: config,
      });

    if (error) {
      console.error('월별 설정 스냅샷 저장 실패:', error);
      throw error;
    }
  }

  // 월별 마일리지 설정 스냅샷 조회
  async getMonthlyConfigSnapshot(
    clubId: string,
    year: number,
    month: number
  ): Promise<MileageConfig | null> {
    const { data, error } = await supabase
      .from('club_monthly_configs')
      .select('mileage_config')
      .eq('club_id', clubId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      console.error('월별 설정 스냅샷 조회 실패:', error);
      return null;
    }

    return data?.mileage_config || null;
  }

  // 클럽 랭킹 조회 (월별)
  async getClubRanking(clubId: string, month?: { year: number; month: number }): Promise<ClubRanking[]> {
    // 클럽 정보 조회 (enabled_categories 확인)
    const club = await this.getClubById(clubId);
    const enabledCategories = club.enabled_categories || this.getAllCategories();
    console.log('📊 활성화된 카테고리:', enabledCategories);

    // 클럽 멤버 조회 (show_mileage=true만)
    const { data: members, error: membersError } = await supabase
      .from('club_members')
      .select('user_id, club_nickname, club_profile_image')
      .eq('club_id', clubId)
      .eq('show_mileage', true);

    if (membersError || !members || members.length === 0) {
      console.log('📊 클럽 멤버 없음');
      return [];
    }

    const userIds = members.map((m) => m.user_id);
    console.log('📊 클럽 멤버:', userIds);

    // 닉네임 맵 생성
    const nicknameMap: Record<string, string> = {};
    const clubProfileImageMap: Record<string, string> = {};
    members.forEach((m) => {
      if (m.club_nickname) {
        nicknameMap[m.user_id] = m.club_nickname;
      }
      if (m.club_profile_image) {
        clubProfileImageMap[m.user_id] = m.club_profile_image;
      }
    });

    // 월 정보 (기본값: 현재 월)
    const targetMonth = month || {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    };

    // 클럽 마일리지 스냅샷 조회
    const { data: mileageData, error: mileageError } = await supabase
      .from('club_workout_mileage')
      .select('user_id, workout_id, mileage')
      .eq('club_id', clubId)
      .eq('year', targetMonth.year)
      .eq('month', targetMonth.month)
      .in('user_id', userIds);

    if (mileageError) {
      console.error('❌ 마일리지 스냅샷 조회 실패:', mileageError);
      throw mileageError;
    }

    console.log('📊 마일리지 스냅샷:', mileageData);

    // 스냅샷이 없으면 자동 생성
    if (!mileageData || mileageData.length === 0) {
      console.log('⚠️ 마일리지 스냅샷 없음 - 자동 생성 시작');
      await this.recalculateClubMonthMileage(clubId, targetMonth.year, targetMonth.month);

      // 다시 조회
      const { data: newMileageData, error: newMileageError } = await supabase
        .from('club_workout_mileage')
        .select('user_id, workout_id, mileage')
        .eq('club_id', clubId)
        .eq('year', targetMonth.year)
        .eq('month', targetMonth.month)
        .in('user_id', userIds);

      if (newMileageError) {
        console.error('❌ 마일리지 스냅샷 재조회 실패:', newMileageError);
        throw newMileageError;
      }

      console.log('✅ 마일리지 스냅샷 생성 완료:', newMileageData);

      // 새로 생성된 데이터로 교체
      const workoutIds = (newMileageData || []).map(m => m.workout_id);

      // 운동 기록 조회 (카테고리 필터링용)
      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select('id, category, sub_type')
        .in('id', workoutIds);

      if (workoutsError) {
        console.error('❌ 운동 기록 조회 실패:', workoutsError);
        throw workoutsError;
      }

      // workout_id별 카테고리 맵
      const workoutCategoryMap: Record<string, string> = {};
      (workouts || []).forEach(w => {
        const key = w.sub_type ? `${w.category}-${w.sub_type}` : w.category;
        workoutCategoryMap[w.id] = key;
      });

      // 사용자별 마일리지 집계 (활성화된 카테고리만)
      const userMileageMap: Record<string, { mileage: number; count: number }> = {};
      let filteredCount = 0;
      let includedCount = 0;

      (newMileageData || []).forEach((record) => {
        const category = workoutCategoryMap[record.workout_id];

        // 활성화된 카테고리만 카운트
        if (!category || !enabledCategories.includes(category)) {
          filteredCount++;
          console.log(`🚫 필터링됨: ${category} (mileage: ${record.mileage})`);
          return;
        }

        includedCount++;
        if (!userMileageMap[record.user_id]) {
          userMileageMap[record.user_id] = { mileage: 0, count: 0 };
        }

        userMileageMap[record.user_id].mileage += record.mileage;
        userMileageMap[record.user_id].count += 1;
      });

      console.log(`📊 마일리지 필터링: ${includedCount}개 포함, ${filteredCount}개 제외`);
      console.log('📊 사용자별 마일리지:', userMileageMap);

      // 사용자 정보 조회
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, display_name, profile_image')
        .in('id', userIds);

      if (usersError) {
        console.error('사용자 정보 조회 실패:', usersError);
        throw usersError;
      }

      // 명예의 전당 멤버 조회
      const { data: hofMembers } = await supabase
        .from('hall_of_fame')
        .select('user_id, reason')
        .eq('club_id', clubId)
        .in('user_id', userIds);

      const hofSet = new Set(hofMembers?.map((h) => h.user_id) || []);
      const hofReasonMap: Record<string, string> = {};
      hofMembers?.forEach((h) => {
        if (h.reason) {
          hofReasonMap[h.user_id] = h.reason;
        }
      });

      // 랭킹 생성 (클럽 닉네임 및 클럽 프로필 이미지 우선 사용)
      const ranking: ClubRanking[] = (users || [])
        .map((user) => ({
          user_id: user.id,
          display_name: nicknameMap[user.id] || user.display_name,
          profile_image: clubProfileImageMap[user.id] || user.profile_image,
          total_mileage: userMileageMap[user.id]?.mileage || 0,
          workout_count: userMileageMap[user.id]?.count || 0,
          rank: 0,
          is_hall_of_fame: hofSet.has(user.id),
          hof_reason: hofReasonMap[user.id] || undefined,
        }))
        .sort((a, b) => b.total_mileage - a.total_mileage)
        .map((item, index) => ({ ...item, rank: index + 1 }));

      return ranking;
    }

    // workout_id 목록 추출
    const workoutIds = (mileageData || []).map(m => m.workout_id);

    // 운동 기록 조회 (카테고리 필터링용)
    const { data: workouts, error: workoutsError } = await supabase
      .from('workouts')
      .select('id, category, sub_type')
      .in('id', workoutIds);

    if (workoutsError) {
      console.error('❌ 운동 기록 조회 실패:', workoutsError);
      throw workoutsError;
    }

    // workout_id별 카테고리 맵
    const workoutCategoryMap: Record<string, string> = {};
    (workouts || []).forEach(w => {
      const key = w.sub_type ? `${w.category}-${w.sub_type}` : w.category;
      workoutCategoryMap[w.id] = key;
    });

    // 사용자별 마일리지 집계 (활성화된 카테고리만)
    const userMileageMap: Record<string, { mileage: number; count: number }> = {};
    let filteredCount = 0;
    let includedCount = 0;

    (mileageData || []).forEach((record) => {
      const category = workoutCategoryMap[record.workout_id];

      // 활성화된 카테고리만 카운트
      if (!category || !enabledCategories.includes(category)) {
        filteredCount++;
        console.log(`🚫 필터링됨: ${category} (mileage: ${record.mileage})`);
        return;
      }

      includedCount++;
      if (!userMileageMap[record.user_id]) {
        userMileageMap[record.user_id] = { mileage: 0, count: 0 };
      }

      userMileageMap[record.user_id].mileage += record.mileage;
      userMileageMap[record.user_id].count += 1;
    });

    console.log(`📊 마일리지 필터링: ${includedCount}개 포함, ${filteredCount}개 제외`);
    console.log('📊 사용자별 마일리지:', userMileageMap);

    // 사용자 정보 조회
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, profile_image')
      .in('id', userIds);

    if (usersError) {
      console.error('사용자 정보 조회 실패:', usersError);
      throw usersError;
    }

    // 명예의 전당 멤버 조회
    const { data: hofMembers } = await supabase
      .from('hall_of_fame')
      .select('user_id, reason')
      .eq('club_id', clubId)
      .in('user_id', userIds);

    const hofSet = new Set(hofMembers?.map((h) => h.user_id) || []);
    const hofReasonMap: Record<string, string> = {};
    hofMembers?.forEach((h) => {
      if (h.reason) {
        hofReasonMap[h.user_id] = h.reason;
      }
    });

    // 랭킹 생성 (클럽 닉네임 및 클럽 프로필 이미지 우선 사용)
    const ranking: ClubRanking[] = (users || [])
      .map((user) => ({
        user_id: user.id,
        display_name: nicknameMap[user.id] || user.display_name,
        profile_image: clubProfileImageMap[user.id] || user.profile_image,
        total_mileage: userMileageMap[user.id]?.mileage || 0,
        workout_count: userMileageMap[user.id]?.count || 0,
        rank: 0,
        is_hall_of_fame: hofSet.has(user.id),
        hof_reason: hofReasonMap[user.id] || undefined,
      }))
      .sort((a, b) => b.total_mileage - a.total_mileage)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return ranking;
  }

  // 클럽 상세 통계 조회 (운동별 마일리지) - 스냅샷 방식
  async getClubDetailedStats(
    clubId: string,
    month?: { year: number; month: number }
  ): Promise<ClubDetailedStats[]> {
    // 클럽 정보 조회 (설정 가져오기)
    const club = await this.getClubById(clubId);
    const countExcludedWorkouts = club.count_excluded_workouts_in_days ?? true;
    const enabledCategories = club.enabled_categories || this.getAllCategories();
    console.log('📊 [상세통계] 활성화된 카테고리:', enabledCategories);

    // 클럽 멤버 조회
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id, club_nickname, joined_at')
      .eq('club_id', clubId);

    if (!members || members.length === 0) {
      return [];
    }

    const userIds = members.map((m) => m.user_id);

    // 닉네임 맵 생성
    const nicknameMap: Record<string, string> = {};
    const joinedAtMap: Record<string, string> = {};
    members.forEach((m) => {
      if (m.club_nickname) {
        nicknameMap[m.user_id] = m.club_nickname;
      }
      if (m.joined_at) {
        joinedAtMap[m.user_id] = m.joined_at;
      }
    });

    // 명예의 전당 조회
    const { data: hofMembers } = await supabase
      .from('hall_of_fame')
      .select('user_id')
      .eq('club_id', clubId)
      .in('user_id', userIds);
    const hofSet = new Set(hofMembers?.map((h) => h.user_id) || []);

    // 월 정보 (기본값: 현재 월)
    const targetMonth = month || {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    };

    // 클럽 마일리지 스냅샷 조회 (workout_date 포함)
    const { data: mileageData } = await supabase
      .from('club_workout_mileage')
      .select('user_id, workout_id, mileage, workout_date')
      .eq('club_id', clubId)
      .eq('year', targetMonth.year)
      .eq('month', targetMonth.month)
      .in('user_id', userIds);

    if (!mileageData || mileageData.length === 0) {
      return [];
    }

    // workout_id로 운동 종목 조회 (value, unit 포함)
    const workoutIds = Array.from(new Set(mileageData.map(m => m.workout_id)));
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, category, sub_type, value, unit')
      .in('id', workoutIds);

    // workout_id별 카테고리, 값, 단위 맵
    const workoutCategoryMap: Record<string, string> = {};
    const workoutValueMap: Record<string, number> = {};
    const workoutUnitMap: Record<string, string> = {};
    (workouts || []).forEach(w => {
      const key = w.sub_type ? `${w.category}-${w.sub_type}` : w.category;
      workoutCategoryMap[w.id] = key;
      workoutValueMap[w.id] = w.value || 0;
      workoutUnitMap[w.id] = w.unit || '';
    });

    // 사용자별 통계 집계
    const userStatsMap: Record<
      string,
      {
        total: number;
        byWorkout: Record<string, number>;
        byWorkoutValues: Record<string, number>;
        byWorkoutUnits: Record<string, string>;
        workoutDates: Set<string>; // 운동한 날짜들 (YYYY-MM-DD)
      }
    > = {};

    // 초기화
    userIds.forEach(userId => {
      userStatsMap[userId] = {
        total: 0,
        byWorkout: {},
        byWorkoutValues: {},
        byWorkoutUnits: {},
        workoutDates: new Set(),
      };
    });

    // 마일리지 데이터에서 집계
    mileageData.forEach((record) => {
      const mileage = record.mileage || 0;
      const workoutDate = record.workout_date;
      const category = workoutCategoryMap[record.workout_id];
      const value = workoutValueMap[record.workout_id] || 0;
      const unit = workoutUnitMap[record.workout_id] || '';

      // 활성화된 카테고리만 처리
      if (!category || !enabledCategories.includes(category)) {
        return;
      }

      // 운동일수 집계 (미산입 운동 포함 여부 확인)
      if (workoutDate && (countExcludedWorkouts || mileage > 0)) {
        userStatsMap[record.user_id].workoutDates.add(workoutDate);
      }

      // 마일리지가 있는 운동만 집계
      if (mileage > 0) {
        userStatsMap[record.user_id].total += mileage;
        userStatsMap[record.user_id].byWorkout[category] =
          (userStatsMap[record.user_id].byWorkout[category] || 0) + mileage;
        userStatsMap[record.user_id].byWorkoutValues[category] =
          (userStatsMap[record.user_id].byWorkoutValues[category] || 0) + value;
        // 단위는 한 번만 저장 (같은 카테고리는 같은 단위)
        if (!userStatsMap[record.user_id].byWorkoutUnits[category]) {
          userStatsMap[record.user_id].byWorkoutUnits[category] = unit;
        }
      }
    });

    // 사용자 정보 조회
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', userIds);

    // 상세 통계 생성 (클럽 닉네임 우선, 없으면 users.display_name 사용)
    const stats: ClubDetailedStats[] = (users || [])
      .map((user) => {
        const userStats = userStatsMap[user.id];
        return {
          user_id: user.id,
          display_name: nicknameMap[user.id] || user.display_name,
          rank: 0,
          total_mileage: userStats.total,
          workout_days: userStats.workoutDates.size,
          by_workout: userStats.byWorkout,
          by_workout_values: userStats.byWorkoutValues,
          by_workout_units: userStats.byWorkoutUnits,
          is_hall_of_fame: hofSet.has(user.id),
          joined_at: joinedAtMap[user.id],
        };
      })
      .sort((a, b) => b.total_mileage - a.total_mileage)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return stats;
  }

  // 기본 마일리지 계수 (나눗셈 방식: X km/m/층/분 당 1 마일리지)
  // 동적으로 workout_types에서 로드하되, 기본값 제공
  async getDefaultMileageConfig(): Promise<MileageConfig> {
    const config: MileageConfig = {};

    try {
      // workout_types 테이블에서 모든 운동 종목 조회
      const workoutTypes = await import('./workoutTypeService').then(m => m.default.getActiveWorkoutTypes());

      // 각 운동 종목과 세부타입에 대한 기본 계수 생성
      for (const type of workoutTypes) {
        if (type.sub_types && type.sub_types.length > 0) {
          // 세부타입이 있는 경우
          for (const subType of type.sub_types) {
            const key = `${type.name}-${subType}`;
            config[key] = 1; // 기본값 1
          }
        } else {
          // 세부타입이 없는 경우
          config[type.name] = 1; // 기본값 1
        }
      }
    } catch (error) {
      console.error('workout_types 로드 실패, 하드코딩 기본값 사용:', error);
      // 폴백: 기존 하드코딩 값
      return {
        '달리기-트레드밀': 1,
        '달리기-러닝': 1,
        '사이클-실외': 3,
        '사이클-실내': 5,
        '수영': 200,
        '계단': 20,
        '복싱-샌드백/미트': 1.78,
        '복싱-스파링': 0.77,
        '요가-일반': 3.27,
        '요가-빈야사/아쉬탕가': 2.45,
      };
    }

    return config;
  }

  // 불완전한 마일리지 계수 보정 (새 운동 타입 자동 대응)
  // 기존 클럽이 없는 항목은 0으로 설정 (비활성화)
  async normalizeMileageConfig(partialConfig?: Partial<MileageConfig> | null): Promise<MileageConfig> {
    const defaultConfig = await this.getDefaultMileageConfig();

    if (!partialConfig) {
      return defaultConfig;
    }

    // 기본 설정을 복사하고, 기존 값으로 덮어쓰기
    const normalized: MileageConfig = { ...defaultConfig };

    for (const key in normalized) {
      if (key in partialConfig) {
        // 기존 클럽이 가지고 있던 값 유지
        normalized[key] = partialConfig[key] as number;
      } else {
        // 없는 항목은 기본값 유지 (새로운 운동 종목)
        // 기존 항목인데 partialConfig에 없으면 0 (비활성화)
        if (!(key in partialConfig)) {
          normalized[key] = defaultConfig[key] || 0;
        }
      }
    }

    // partialConfig에 있지만 defaultConfig에 없는 항목도 유지 (이전 운동 종목)
    for (const key in partialConfig) {
      if (!(key in normalized)) {
        normalized[key] = partialConfig[key] as number;
      }
    }

    return normalized;
  }

  // 신규 클럽 기본 활성화 카테고리 (달리기만)
  getDefaultEnabledCategories(): string[] {
    return ['달리기-트레드밀', '달리기-러닝'];
  }

  // 모든 사용 가능한 카테고리 (기존 클럽 하위 호환성용)
  getAllCategories(): string[] {
    return [
      '달리기-트레드밀',
      '달리기-러닝',
      '사이클-실외',
      '사이클-실내',
      '수영',
      '계단',
      '복싱-샌드백/미트',
      '복싱-스파링',
      '요가-일반',
      '요가-빈야사/아쉬탕가',
    ];
  }

  // 마일리지 계산 (나눗셈 방식)
  calculateMileage(
    category: string,
    subType: string | null,
    value: number,
    mileageConfig?: MileageConfig,
    ratios?: Record<string, number>
  ): number {
    // config가 없으면 빈 객체 사용 (모든 키는 기본값 1 사용)
    const config = mileageConfig || {};

    // 비율이 있는 경우: 각 서브타입의 마일리지를 비율에 따라 합산
    // 예: 요가 60분, 일반 40% + 빈야사 60%
    // = (60 * 0.4) / 3.27 + (60 * 0.6) / 2.45
    if (ratios && Object.keys(ratios).length > 0) {
      console.log('🔍 [혼합 마일리지 계산]');
      console.log('  카테고리:', category);
      console.log('  총 시간/거리:', value);
      console.log('  비율:', ratios);

      let totalMileage = 0;
      for (const [subTypeName, ratio] of Object.entries(ratios)) {
        const key = `${category}-${subTypeName}`;
        const coefficient = config[key] || 1;
        const partialMileage = (value * ratio) / coefficient;

        console.log(`  - ${subTypeName}: (${value} × ${ratio}) / ${coefficient} = ${partialMileage.toFixed(4)}`);

        totalMileage += partialMileage;
      }

      console.log('  → 총 마일리지:', totalMileage.toFixed(4));
      return totalMileage;
    }

    // 비율이 없는 경우: 기존 방식 (단일 서브타입)
    const key = subType ? `${category}-${subType}` : category;
    const coefficient = config[key] || 1;
    // 나눗셈 방식: 거리 / 계수 = 마일리지
    // 예: 3km / 3 = 1 마일리지
    return value / coefficient;
  }

  // 현재 월의 모든 클럽 멤버 운동 기록 마일리지 재계산 (스냅샷 방식)
  async recalculateCurrentMonthMileage(clubId: string, _newConfig: MileageConfig): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await this.recalculateClubMonthMileage(clubId, year, month);
  }

  // 어드민에게 클럽 생성 신청 이메일 발송
  private async sendClubRequestNotification(club: Club, creatorId: string): Promise<void> {
    try {
      console.log('📧 클럽 생성 이메일 발송 시작:', club.name);

      // 어드민 이메일 목록 조회
      const adminEmails = await userService.getAdminEmails();
      console.log('👥 조회된 어드민 이메일:', adminEmails);

      if (adminEmails.length === 0) {
        console.warn('⚠️  어드민 이메일이 없어 알림을 보낼 수 없습니다.');
        return;
      }

      // 생성자 정보 조회
      const { data: creator } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', creatorId)
        .single();

      const creatorName = creator?.display_name || '알 수 없음';

      // 각 어드민에게 이메일 발송
      await Promise.all(
        adminEmails.map((adminEmail) =>
          sendClubRequestEmail({
            adminEmail,
            clubName: club.name,
            clubDescription: club.description,
            creatorName,
          })
        )
      );

      console.log(`✅ ${adminEmails.length}명의 어드민에게 이메일 발송 완료`);
    } catch (error) {
      console.error('❌ 어드민 이메일 발송 실패:', error);
      // 에러를 throw하지 않아 클럽 생성은 계속 진행됨
    }
  }

  // ============================================
  // 어드민 관련 메서드
  // ============================================

  // 승인 대기 중인 클럽 목록 조회
  async getPendingClubs(): Promise<Club[]> {
    const { data, error } = await supabase
      .from('clubs')
      .select(`
        *,
        users!clubs_created_by_fkey(display_name, profile_image)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('승인 대기 클럽 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  // 클럽 승인
  async approveClub(clubId: string, adminUserId: string): Promise<void> {
    const { error } = await supabase
      .from('clubs')
      .update({
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: adminUserId,
      })
      .eq('id', clubId);

    if (error) {
      console.error('클럽 승인 실패:', error);
      throw error;
    }
  }

  // 클럽 거부
  async rejectClub(clubId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('clubs')
      .update({
        status: 'closed',
        rejection_reason: reason,
      })
      .eq('id', clubId);

    if (error) {
      console.error('클럽 거부 실패:', error);
      throw error;
    }
  }

  // 모든 클럽 조회 (어드민용 - 상태 무관)
  async getAllClubsForAdmin(): Promise<Club[]> {
    const { data, error } = await supabase
      .from('clubs')
      .select(`
        *,
        users!clubs_created_by_fkey(display_name, profile_image)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('전체 클럽 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  // 클럽 운동 피드 조회
  async getClubWorkoutFeed(
    clubId: string,
    date: Date,
    currentUserId: string
  ): Promise<import('./feedService').WorkoutFeedItem[]> {
    // 1) show_in_feed=true 멤버만 조회
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id, club_nickname, club_profile_image')
      .eq('club_id', clubId)
      .eq('show_in_feed', true);

    if (!members || members.length === 0) return [];

    // 1-1) 이 클럽에서 내가 차단한 유저 제외
    const { data: blocks } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId)
      .eq('club_id', clubId);
    const blockedIds = blocks?.map((b: any) => b.blocked_id) || [];
    const filteredMembers = blockedIds.length > 0
      ? members.filter((m) => !blockedIds.includes(m.user_id))
      : members;

    if (filteredMembers.length === 0) return [];

    // 2) 해당 날짜 운동 조회 (workout_time ASC)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .in(
        'user_id',
        filteredMembers.map((m) => m.user_id)
      )
      .gte('workout_time', startOfDay.toISOString())
      .lte('workout_time', endOfDay.toISOString())
      .order('workout_time', { ascending: true });

    if (!workouts || workouts.length === 0) return [];

    // 3) 사용자 정보 조회
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, profile_image')
      .in(
        'id',
        filteredMembers.map((m) => m.user_id)
      );

    // 4) 좋아요/댓글 수 조회
    const workoutIds = workouts.map((w) => w.id);
    const { data: likes } = await supabase
      .from('workout_likes')
      .select('workout_id, user_id')
      .eq('club_id', clubId)
      .in('workout_id', workoutIds);

    const { data: comments } = await supabase
      .from('workout_comments')
      .select('workout_id')
      .eq('club_id', clubId)
      .in('workout_id', workoutIds);

    // 5) 맵 구성 및 반환
    const userMap = new Map(users?.map((u) => [u.id, u]) || []);
    const nicknameMap = Object.fromEntries(
      filteredMembers.filter((m) => m.club_nickname).map((m) => [m.user_id, m.club_nickname!])
    );
    const clubProfileImageMap = Object.fromEntries(
      filteredMembers.filter((m) => m.club_profile_image).map((m) => [m.user_id, m.club_profile_image!])
    );

    const likesMap = new Map();
    workoutIds.forEach((id) => likesMap.set(id, { count: 0, isLiked: false }));
    likes?.forEach((like) => {
      const current = likesMap.get(like.workout_id)!;
      current.count++;
      if (like.user_id === currentUserId) current.isLiked = true;
    });

    const commentsMap = new Map();
    workoutIds.forEach((id) => commentsMap.set(id, 0));
    comments?.forEach((c) => commentsMap.set(c.workout_id, (commentsMap.get(c.workout_id) || 0) + 1));

    // n번째 운동은 created_at(등록 순서) 기준으로 별도 계산
    const createdAtOrder = [...workouts]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const workoutNumberMap = new Map(createdAtOrder.map((w, i) => [w.id, i + 1]));

    return workouts.map((workout) => {
      const user = userMap.get(workout.user_id);
      const likeInfo = likesMap.get(workout.id) || { count: 0, isLiked: false };

      // 클럽 프로필 이미지가 있으면 우선 사용, 없으면 유저 프로필 이미지
      const profileImage = clubProfileImageMap[workout.user_id] || user?.profile_image;

      return {
        workout,
        user_display_name: nicknameMap[workout.user_id] || user?.display_name || '알 수 없음',
        user_profile_image: profileImage,
        club_nickname: nicknameMap[workout.user_id],
        like_count: likeInfo.count,
        comment_count: commentsMap.get(workout.id) || 0,
        is_liked_by_me: likeInfo.isLiked,
        workout_number: workoutNumberMap.get(workout.id) ?? undefined, // 등록(created_at) 순서 기준
      };
    });
  }

  // 개인 설정 업데이트
  async updateMemberSettings(
    clubId: string,
    userId: string,
    settings: { show_in_feed?: boolean; show_mileage?: boolean }
  ): Promise<void> {
    const updateData: any = {};
    if (settings.show_in_feed !== undefined) updateData.show_in_feed = settings.show_in_feed;
    if (settings.show_mileage !== undefined) updateData.show_mileage = settings.show_mileage;

    const { error } = await supabase
      .from('club_members')
      .update(updateData)
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // 개인 설정 조회
  async getMemberSettings(
    clubId: string,
    userId: string
  ): Promise<{
    show_in_feed: boolean;
    show_mileage: boolean;
  }> {
    const { data, error } = await supabase
      .from('club_members')
      .select('show_in_feed, show_mileage')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    return {
      show_in_feed: data?.show_in_feed ?? true,
      show_mileage: data?.show_mileage ?? true,
    };
  }

  // ============================================
  // 명예의 전당 (Hall of Fame) 메서드
  // ============================================

  /**
   * 명예의 전당 멤버 조회
   */
  async getHallOfFameMembers(clubId: string): Promise<HallOfFame[]> {
    const { data, error } = await supabase
      .from('hall_of_fame')
      .select('*')
      .eq('club_id', clubId)
      .order('inducted_at', { ascending: false });

    if (error) {
      console.error('명예의 전당 멤버 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * 명예의 전당에 멤버 추가
   */
  async addToHallOfFame(clubId: string, userId: string, adminUserId: string, reason?: string): Promise<void> {
    const { error } = await supabase.from('hall_of_fame').insert({
      club_id: clubId,
      user_id: userId,
      inducted_by: adminUserId,
      reason: reason || null,
    });

    if (error) {
      // 이미 존재하는 경우
      if (error.code === '23505') {
        throw new Error('이미 명예의 전당에 등재된 멤버입니다.');
      }
      console.error('명예의 전당 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 명예의 전당에서 멤버 제거
   */
  async removeFromHallOfFame(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('hall_of_fame')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('명예의 전당 제거 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 유저가 명예의 전당 멤버인지 확인
   */
  async isHallOfFameMember(clubId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('hall_of_fame')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('HOF 멤버 확인 실패:', error);
      return false;
    }

    return !!data;
  }

  // ============================================
  // 클럽 운동 마일리지 스냅샷 메서드
  // ============================================

  /**
   * 운동의 클럽별 마일리지 저장 (스냅샷)
   */
  async saveWorkoutMileage(
    clubId: string,
    workoutId: string,
    userId: string,
    workout: {
      category: string;
      sub_type: string | null;
      value: number;
      workout_time: string;
      sub_type_ratios?: Record<string, number>;
    }
  ): Promise<void> {
    const club = await this.getClubById(clubId);
    const mileageConfig = club.mileage_config || await this.getDefaultMileageConfig();

    const mileage = this.calculateMileage(
      workout.category,
      workout.sub_type,
      workout.value,
      mileageConfig,
      workout.sub_type_ratios
    );

    // workout_time 기준으로 KST(UTC+9) 날짜 계산
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const d = new Date(new Date(workout.workout_time).getTime() + KST_OFFSET);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const workout_date = `${year}-${String(month).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    const { error: deleteError } = await supabase
      .from('club_workout_mileage')
      .delete()
      .eq('club_id', clubId)
      .eq('workout_id', workoutId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('클럽 마일리지 삭제 실패:', deleteError);
      throw deleteError;
    }

    const { error: insertError } = await supabase
      .from('club_workout_mileage')
      .insert({ club_id: clubId, workout_id: workoutId, user_id: userId, mileage, year, month, workout_date, mileage_config_snapshot: mileageConfig });

    if (insertError) {
      console.error('클럽 마일리지 저장 실패:', insertError);
      throw insertError;
    }
  }

  /**
   * 클럽의 특정 월 마일리지 스냅샷 조회
   */
  async getClubMonthMileage(
    clubId: string,
    year: number,
    month: number
  ): Promise<ClubWorkoutMileage[]> {
    const { data, error } = await supabase
      .from('club_workout_mileage')
      .select('*')
      .eq('club_id', clubId)
      .eq('year', year)
      .eq('month', month);

    if (error) {
      console.error('클럽 마일리지 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * 사용자의 클럽별 마일리지 합계
   */
  async getUserClubMileage(
    clubId: string,
    userId: string,
    year: number,
    month: number
  ): Promise<number> {
    const { data, error } = await supabase
      .from('club_workout_mileage')
      .select('mileage')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month);

    if (error) {
      console.error('사용자 마일리지 조회 실패:', error);
      throw error;
    }

    return (data || []).reduce((sum, row) => sum + row.mileage, 0);
  }

  /**
   * 클럽의 현재 월 모든 마일리지 재계산 (계수 변경 시)
   */
  async recalculateClubMonthMileage(clubId: string, year: number, month: number): Promise<void> {
    console.log(`🔄 클럽 ${clubId} ${year}년 ${month}월 마일리지 재계산 시작...`);

    const club = await this.getClubById(clubId);
    const mileageConfig = club.mileage_config || await this.getDefaultMileageConfig();

    // 해당 월의 모든 클럽 멤버 조회
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId);

    if (!members || members.length === 0) {
      console.log('멤버 없음');
      return;
    }

    const userIds = members.map(m => m.user_id);

    // 해당 월의 모든 운동 기록 조회 (workout_time 기준, KST = UTC+9)
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const startDate = new Date(Date.UTC(year, month - 1, 1) - KST_OFFSET).toISOString();
    const endDate = new Date(Date.UTC(year, month, 1) - KST_OFFSET).toISOString();

    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, user_id, category, sub_type, value, workout_time, created_at, sub_type_ratios')
      .in('user_id', userIds)
      .gte('workout_time', startDate)
      .lt('workout_time', endDate);

    // 해당 월 기존 스냅샷 삭제 (year/month 기준)
    const { error: deleteError } = await supabase
      .from('club_workout_mileage')
      .delete()
      .eq('club_id', clubId)
      .eq('year', year)
      .eq('month', month);

    if (deleteError) {
      console.error('기존 마일리지 스냅샷 삭제 실패:', deleteError);
      throw deleteError;
    }

    if (!workouts || workouts.length === 0) {
      console.log('운동 기록 없음 - 스냅샷 초기화 완료');
      return;
    }

    // workout_time KST 기준으로 재계산 후 insert (DELETE 후이므로 충돌 없음)
    const calculatedAt = new Date().toISOString();
    const rows = workouts.map(workout => {
      const kstDate = new Date(new Date(workout.workout_time).getTime() + KST_OFFSET);
      const kstYear = kstDate.getUTCFullYear();
      const kstMonth = kstDate.getUTCMonth() + 1;
      const kstWorkoutDate = kstDate.toISOString().split('T')[0];

      const mileage = this.calculateMileage(
        workout.category,
        workout.sub_type,
        workout.value,
        mileageConfig,
        workout.sub_type_ratios || undefined
      );

      return {
        club_id: clubId,
        workout_id: workout.id,
        user_id: workout.user_id,
        mileage,
        year: kstYear,
        month: kstMonth,
        workout_date: kstWorkoutDate,
        mileage_config_snapshot: mileageConfig,
        calculated_at: calculatedAt,
      };
    });

    const { error: insertError } = await supabase
      .from('club_workout_mileage')
      .insert(rows);

    if (insertError) {
      console.error('마일리지 재계산 insert 실패:', insertError);
      throw insertError;
    }

    console.log(`✅ ${workouts.length}개 운동 마일리지 재계산 완료`);
  }
}

export default new ClubService();
