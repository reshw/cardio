import { supabase } from '../lib/supabase';

export interface Club {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  invite_code: string;
  mileage_config: MileageConfig;
  logo_url?: string;
  member_count?: number;
  is_member?: boolean;
}

export interface MileageConfig {
  '달리기-트레드밀': number;
  '달리기-러닝': number;
  '사이클-실외': number;
  '사이클-실내': number;
  '수영': number;
  '계단': number;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  display_order: number;
  user?: {
    display_name: string;
    profile_image?: string;
  };
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
      })
      .select()
      .single();

    if (error) {
      console.error('❌ 클럽 생성 실패:', error);
      throw new Error(`클럽 생성 실패: ${error.message}`);
    }

    console.log('✅ 클럽 생성 성공:', club);

    // 생성자를 admin으로 자동 가입
    await this.joinClub(club.id, data.created_by, 'admin');

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

  // 초대 코드로 클럽 가입
  async joinClubByInviteCode(inviteCode: string, userId: string): Promise<Club> {
    const club = await this.findClubByInviteCode(inviteCode);

    if (!club) {
      throw new Error('존재하지 않는 초대 코드입니다.');
    }

    // 이미 가입했는지 확인
    const isMember = await this.isClubMember(club.id, userId);
    if (isMember) {
      throw new Error('이미 가입한 클럽입니다.');
    }

    await this.joinClub(club.id, userId);
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
    const clubsWithOrder: MyClubWithOrder[] = members.map((member) => {
      const club = clubs?.find((c) => c.id === member.club_id);
      return {
        ...club!,
        display_order: member.display_order,
        member_id: member.id,
      };
    });

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
    data: { name?: string; description?: string; mileage_config?: MileageConfig; logo_url?: string }
  ): Promise<Club> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.mileage_config !== undefined) updateData.mileage_config = data.mileage_config;
    if (data.logo_url !== undefined) updateData.logo_url = data.logo_url;

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
  async joinClub(clubId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    const { error } = await supabase.from('club_members').insert({
      club_id: clubId,
      user_id: userId,
      role,
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

  // 클럽 랭킹 조회 (월별)
  async getClubRanking(clubId: string, month?: { year: number; month: number }): Promise<ClubRanking[]> {
    // 클럽 정보 조회 (마일리지 설정 포함)
    const { data: club } = await supabase
      .from('clubs')
      .select('mileage_config')
      .eq('id', clubId)
      .single();

    const mileageConfig = club?.mileage_config || this.getDefaultMileageConfig();

    // 클럽 멤버 조회
    const { data: members, error: membersError } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId);

    if (membersError || !members || members.length === 0) {
      console.log('📊 클럽 멤버 없음');
      return [];
    }

    const userIds = members.map((m) => m.user_id);
    console.log('📊 클럽 멤버:', userIds);

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

    (workouts || []).forEach((workout) => {
      if (!userMileageMap[workout.user_id]) {
        userMileageMap[workout.user_id] = { mileage: 0, count: 0 };
      }

      // 마일리지가 null이거나 0이면 재계산
      let mileage = workout.mileage || 0;
      if (mileage === 0 && workout.category) {
        mileage = this.calculateMileage(workout.category, workout.sub_type, workout.value, mileageConfig);
        console.log(`🔄 마일리지 재계산: ${workout.category}-${workout.sub_type} ${workout.value} → ${mileage}`);
      }

      userMileageMap[workout.user_id].mileage += mileage;
      userMileageMap[workout.user_id].count += 1;
    });

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

    // 랭킹 생성
    const ranking: ClubRanking[] = (users || [])
      .map((user) => ({
        user_id: user.id,
        display_name: user.display_name,
        profile_image: user.profile_image,
        total_mileage: userMileageMap[user.id]?.mileage || 0,
        workout_count: userMileageMap[user.id]?.count || 0,
        rank: 0,
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
    // 클럽 정보 조회
    const { data: club } = await supabase
      .from('clubs')
      .select('mileage_config')
      .eq('id', clubId)
      .single();

    const mileageConfig = club?.mileage_config || this.getDefaultMileageConfig();

    // 클럽 멤버 조회
    const { data: members } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', clubId);

    if (!members || members.length === 0) {
      return [];
    }

    const userIds = members.map((m) => m.user_id);

    // 운동 기록 조회
    let query = supabase
      .from('workouts')
      .select('user_id, category, sub_type, value')
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
          },
        };
      }

      const key = workout.sub_type ? `${workout.category}-${workout.sub_type}` : workout.category;
      const mileage = this.calculateMileage(workout.category, workout.sub_type, workout.value, mileageConfig);

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

    // 상세 통계 생성
    const stats: ClubDetailedStats[] = (users || [])
      .map((user) => {
        const userStats = userStatsMap[user.id];
        return {
          user_id: user.id,
          display_name: user.display_name,
          rank: 0,
          total_mileage: userStats?.total || 0,
          by_workout: {
            '달리기-트레드밀': userStats?.byWorkout['달리기-트레드밀'] || 0,
            '달리기-러닝': userStats?.byWorkout['달리기-러닝'] || 0,
            '사이클-실외': userStats?.byWorkout['사이클-실외'] || 0,
            '사이클-실내': userStats?.byWorkout['사이클-실내'] || 0,
            '수영': userStats?.byWorkout['수영'] || 0,
            '계단': userStats?.byWorkout['계단'] || 0,
          },
        };
      })
      .sort((a, b) => b.total_mileage - a.total_mileage)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return stats;
  }

  // 기본 마일리지 계수
  getDefaultMileageConfig(): MileageConfig {
    return {
      '달리기-트레드밀': 1,
      '달리기-러닝': 1,
      '사이클-실외': 0.333,
      '사이클-실내': 0.2,
      '수영': 0.005,
      '계단': 0.05,
    };
  }

  // 마일리지 계산
  calculateMileage(
    category: string,
    subType: string | null,
    value: number,
    mileageConfig?: MileageConfig
  ): number {
    const key = subType ? `${category}-${subType}` : category;
    const config = mileageConfig || this.getDefaultMileageConfig();
    const coefficient = config[key as keyof MileageConfig] || 1;
    return value * coefficient;
  }
}

export default new ClubService();
