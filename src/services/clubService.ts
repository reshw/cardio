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
}

export interface MileageConfig {
  '달리기-트레드밀': number;
  '달리기-러닝': number;
  '사이클-실외': number;
  '사이클-실내': number;
  '수영': number;
  '계단': number;
  '복싱-샌드백/미트': number;
  '복싱-스파링': number;
  '요가-일반': number;
  '요가-빈야사/아쉬탕가': number;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'admin' | 'member';
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
}

export interface ClubRanking {
  user_id: string;
  display_name: string;
  profile_image?: string;
  total_mileage: number;
  workout_count: number;
  rank: number;
  is_hall_of_fame?: boolean;  // 명예의 전당 여부
}

export interface ClubDetailedStats {
  user_id: string;
  display_name: string;
  rank: number;
  total_mileage: number;
  by_workout: {
    '달리기-트레드밀': number;
    '달리기-러닝': number;
    '사이클-실외': number;
    '사이클-실내': number;
    '수영': number;
    '계단': number;
    '복싱-샌드백/미트': number;
    '복싱-스파링': number;
    '요가-일반': number;
    '요가-빈야사/아쉬탕가': number;
  };
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
      })
      .select()
      .single();

    if (error) {
      console.error('❌ 클럽 생성 실패:', error);
      throw new Error(`클럽 생성 실패: ${error.message}`);
    }

    console.log('✅ 클럽 생성 성공:', club);

    // 생성자를 admin으로 자동 가입
    await this.joinClub(club.id, data.created_by, 'admin', data.club_nickname, data.club_profile_image);

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
      .eq('role', 'admin')
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
      .select('id, club_id, display_order')
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

    return data?.role === 'admin';
  }

  // 클럽 가입
  async joinClub(clubId: string, userId: string, role: 'admin' | 'member' = 'member', clubNickname?: string, clubProfileImage?: string): Promise<void> {
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
  async updateClubNickname(clubId: string, userId: string, nickname: string): Promise<void> {
    const { error } = await supabase
      .from('club_members')
      .update({ club_nickname: nickname })
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) {
      console.error('클럽 닉네임 업데이트 실패:', error);
      throw error;
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
    profile: { club_nickname?: string; club_profile_image?: string | null }
  ): Promise<void> {
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
    // 트랜잭션처럼 처리: 현재 관리자를 멤버로, 새 관리자를 admin으로 변경
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
      .update({ role: 'admin' })
      .eq('club_id', clubId)
      .eq('user_id', newOwnerId);

    if (newOwnerError) {
      console.error('새 관리자 권한 부여 실패:', newOwnerError);
      // 롤백: 현재 관리자 권한 복구
      await supabase
        .from('club_members')
        .update({ role: 'admin' })
        .eq('club_id', clubId)
        .eq('user_id', currentOwnerId);
      throw newOwnerError;
    }
  }

  // 회원 역할 변경 (부매니저 지정/해제)
  async updateMemberRole(clubId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
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

    // 운동 기록 조회
    let query = supabase
      .from('workouts')
      .select('user_id, mileage, created_at, category, sub_type, value')
      .in('user_id', userIds);

    // 월별 필터
    if (month) {
      const startDate = new Date(month.year, month.month - 1, 1);
      const endDate = new Date(month.year, month.month, 0, 23, 59, 59);
      query = query
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
    }

    const { data: workouts, error: workoutsError } = await query;

    if (workoutsError) {
      console.error('❌ 운동 기록 조회 실패:', workoutsError);
      throw workoutsError;
    }

    console.log('📊 운동 기록:', workouts);

    // 사용자별 마일리지 집계
    const userMileageMap: Record<string, { mileage: number; count: number }> = {};
    let filteredCount = 0;
    let includedCount = 0;

    // DB에 저장된 mileage 사용 (마일리지 설정 변경 시 재계산되므로 항상 정확함)
    (workouts || []).forEach((workout) => {
      // 카테고리 키 생성
      const key = workout.sub_type ? `${workout.category}-${workout.sub_type}` : workout.category;

      // 활성화된 카테고리만 카운트
      if (!enabledCategories.includes(key)) {
        filteredCount++;
        console.log(`🚫 필터링됨: ${key} (mileage: ${workout.mileage})`);
        return; // 비활성화된 카테고리는 건너뛰기
      }

      includedCount++;
      if (!userMileageMap[workout.user_id]) {
        userMileageMap[workout.user_id] = { mileage: 0, count: 0 };
      }

      // DB에 저장된 mileage 사용
      const mileage = workout.mileage || 0;

      userMileageMap[workout.user_id].mileage += mileage;
      userMileageMap[workout.user_id].count += 1;
    });

    console.log(`📊 운동 기록 필터링: ${includedCount}개 포함, ${filteredCount}개 제외`);

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
      .select('user_id')
      .eq('club_id', clubId)
      .in('user_id', userIds);

    const hofSet = new Set(hofMembers?.map((h) => h.user_id) || []);

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
      }))
      .sort((a, b) => b.total_mileage - a.total_mileage)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return ranking;
  }

  // 클럽 상세 통계 조회 (운동별 마일리지)
  async getClubDetailedStats(
    clubId: string,
    month?: { year: number; month: number }
  ): Promise<ClubDetailedStats[]> {
    // 클럽 멤버 조회
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id, club_nickname, club_profile_image')
      .eq('club_id', clubId);

    if (!members || members.length === 0) {
      return [];
    }

    const userIds = members.map((m) => m.user_id);

    // 닉네임 및 프로필 이미지 맵 생성
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

    // 운동 기록 조회
    let query = supabase
      .from('workouts')
      .select('user_id, category, sub_type, value, mileage')
      .in('user_id', userIds);

    if (month) {
      const startDate = new Date(month.year, month.month - 1, 1);
      const endDate = new Date(month.year, month.month, 0, 23, 59, 59);
      query = query
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
    }

    const { data: workouts } = await query;

    // 사용자별 운동별 마일리지 집계
    const userStatsMap: Record<
      string,
      {
        total: number;
        byWorkout: Record<string, number>;
      }
    > = {};

    // DB에 저장된 mileage 사용 (마일리지 설정 변경 시 재계산되므로 항상 정확함)
    (workouts || []).forEach((workout) => {
      if (!userStatsMap[workout.user_id]) {
        userStatsMap[workout.user_id] = {
          total: 0,
          byWorkout: {
            '달리기-트레드밀': 0,
            '달리기-러닝': 0,
            '사이클-실외': 0,
            '사이클-실내': 0,
            '수영': 0,
            '계단': 0,
            '복싱-샌드백/미트': 0,
            '복싱-스파링': 0,
            '요가-일반': 0,
            '요가-빈야사/아쉬탕가': 0,
          },
        };
      }

      const key = workout.sub_type ? `${workout.category}-${workout.sub_type}` : workout.category;

      // DB에 저장된 mileage 사용
      const mileage = workout.mileage || 0;

      userStatsMap[workout.user_id].total += mileage;
      if (userStatsMap[workout.user_id].byWorkout[key] !== undefined) {
        userStatsMap[workout.user_id].byWorkout[key] += mileage;
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
          total_mileage: userStats?.total || 0,
          by_workout: {
            '달리기-트레드밀': userStats?.byWorkout['달리기-트레드밀'] || 0,
            '달리기-러닝': userStats?.byWorkout['달리기-러닝'] || 0,
            '사이클-실외': userStats?.byWorkout['사이클-실외'] || 0,
            '사이클-실내': userStats?.byWorkout['사이클-실내'] || 0,
            '수영': userStats?.byWorkout['수영'] || 0,
            '계단': userStats?.byWorkout['계단'] || 0,
            '복싱-샌드백/미트': userStats?.byWorkout['복싱-샌드백/미트'] || 0,
            '복싱-스파링': userStats?.byWorkout['복싱-스파링'] || 0,
            '요가-일반': userStats?.byWorkout['요가-일반'] || 0,
            '요가-빈야사/아쉬탕가': userStats?.byWorkout['요가-빈야사/아쉬탕가'] || 0,
          },
        };
      })
      .sort((a, b) => b.total_mileage - a.total_mileage)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return stats;
  }

  // 기본 마일리지 계수 (나눗셈 방식: X km/m/층/분 당 1 마일리지)
  getDefaultMileageConfig(): MileageConfig {
    return {
      '달리기-트레드밀': 1,      // 1km당 1 마일리지
      '달리기-러닝': 1,          // 1km당 1 마일리지
      '사이클-실외': 3,          // 3km당 1 마일리지
      '사이클-실내': 5,          // 5km당 1 마일리지
      '수영': 200,               // 200m당 1 마일리지
      '계단': 20,                // 20층당 1 마일리지
      '복싱-샌드백/미트': 1.78,  // 1.78분당 1 마일리지 (5.5 MET)
      '복싱-스파링': 0.77,       // 0.77분당 1 마일리지 (12.8 MET)
      '요가-일반': 3.27,         // 3.27분당 1 마일리지 (3 MET)
      '요가-빈야사/아쉬탕가': 2.45, // 2.45분당 1 마일리지 (4 MET)
    };
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
    mileageConfig?: MileageConfig
  ): number {
    const key = subType ? `${category}-${subType}` : category;
    const config = mileageConfig || this.getDefaultMileageConfig();
    const coefficient = config[key as keyof MileageConfig] || 1;
    // 나눗셈 방식: 거리 / 계수 = 마일리지
    // 예: 3km / 3 = 1 마일리지
    return value / coefficient;
  }

  // 현재 월의 모든 클럽 멤버 운동 기록 마일리지 재계산
  async recalculateCurrentMonthMileage(clubId: string, newConfig: MileageConfig): Promise<void> {
    console.log('🔄 현재 월 마일리지 재계산 시작...');

    // 클럽 멤버 조회
    const { data: members, error: membersError } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId);

    if (membersError || !members || members.length === 0) {
      console.log('📊 클럽 멤버 없음');
      return;
    }

    const userIds = members.map((m) => m.user_id);

    // 현재 월의 운동 기록 조회
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { data: workouts, error: workoutsError } = await supabase
      .from('workouts')
      .select('id, category, sub_type, value')
      .in('user_id', userIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (workoutsError) {
      console.error('❌ 운동 기록 조회 실패:', workoutsError);
      throw workoutsError;
    }

    if (!workouts || workouts.length === 0) {
      console.log('📊 현재 월 운동 기록 없음');
      return;
    }

    console.log(`📊 재계산할 운동 기록: ${workouts.length}개`);

    // 각 운동 기록의 마일리지 재계산 및 업데이트
    const updates = workouts.map((workout) => {
      const newMileage = this.calculateMileage(
        workout.category,
        workout.sub_type,
        workout.value,
        newConfig
      );

      return supabase
        .from('workouts')
        .update({ mileage: newMileage })
        .eq('id', workout.id);
    });

    const results = await Promise.all(updates);

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('❌ 마일리지 재계산 실패:', errors);
      throw new Error('일부 운동 기록의 마일리지 업데이트에 실패했습니다.');
    }

    console.log(`✅ ${workouts.length}개 운동 기록 마일리지 재계산 완료`);
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

    // 2) 해당 날짜 운동 조회 (created_at ASC)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .in(
        'user_id',
        members.map((m) => m.user_id)
      )
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: true });

    if (!workouts || workouts.length === 0) return [];

    // 3) 사용자 정보 조회
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, profile_image')
      .in(
        'id',
        members.map((m) => m.user_id)
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
      members.filter((m) => m.club_nickname).map((m) => [m.user_id, m.club_nickname!])
    );
    const clubProfileImageMap = Object.fromEntries(
      members.filter((m) => m.club_profile_image).map((m) => [m.user_id, m.club_profile_image!])
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
}

export default new ClubService();
