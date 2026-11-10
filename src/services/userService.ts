import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  email?: string;
  display_name: string;
  profile_image?: string;
  phone_number?: string;
  is_admin: boolean;
  is_super_admin: boolean;
  is_sub_admin: boolean;
  created_at: string;
  last_login?: string;
}

// 어드민 이메일 목록은 더 이상 클라이언트에서 조회하지 않는다.
// users.email 은 컬럼 권한으로 차단돼 있고, 수신자를 클라이언트가 정하면
// 임의 주소로 메일을 보낼 수 있으므로 api/send-email 이 service_role 로
// 직접 조회한다. (docs/plans/rls-hardening.md §3-3)

class UserService {
  // 모든 회원 조회 (어드민용) — email/전화번호 포함이라 RPC 경유
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.rpc('admin_list_users');

    if (error) {
      console.error('회원 목록 조회 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`회원 목록 조회 실패: ${msg}`);
    }

    return data || [];
  }

  // 회원 검색 (이름, 전화번호, 이메일)
  async searchUsers(query: string): Promise<User[]> {
    const { data, error } = await supabase.rpc('admin_list_users', { p_query: query });

    if (error) {
      console.error('회원 검색 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`회원 검색 실패: ${msg}`);
    }

    return data || [];
  }

  // 회원 강제 탈퇴 (어드민 전용)
  async deleteUserAsAdmin(userId: string): Promise<void> {
    console.log('🗑️ 회원 강제 탈퇴 시작:', userId);

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('❌ users 테이블 삭제 실패:', error);
      throw new Error('회원 삭제에 실패했습니다: ' + error.message);
    }

    console.log('✅ users 테이블에서 삭제 완료');
  }

  // 본인 탈퇴 (App Store Guideline 5.1.1(v)).
  // 하드 삭제하면 clubs.created_by CASCADE 때문에 클럽장이 탈퇴할 때 클럽과
  // 멤버 전원의 데이터가 함께 날아간다 → DB 함수에서 소프트 삭제로 처리한다.
  // 식별자(auth_id/kakao_id)를 끊으므로 재로그인하면 새 계정으로 가입되고,
  // 원본은 deleted_snapshot 에 남아 운영자가 복구할 수 있다.
  // 탈퇴를 막는 클럽 직책 목록. 비어 있으면 탈퇴 가능.
  // (클럽장이 그냥 나가면 클럽이 주인 없이 남으므로 양도가 먼저다)
  async getClubRolesBlockingDeletion(
    userId: string
  ): Promise<{ clubId: string; clubName: string; role: string }[]> {
    const { data, error } = await supabase
      .from('club_members')
      .select('role, club_id, clubs(name)')
      .eq('user_id', userId)
      .in('role', ['manager', 'vice-manager']);

    if (error) {
      console.error('❌ 클럽 직책 조회 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`클럽 직책 확인 실패: ${msg}`);
    }

    return (data ?? []).map((row: any) => ({
      clubId: row.club_id,
      clubName: row.clubs?.name ?? '이름 없는 클럽',
      role: row.role,
    }));
  }

  async deleteAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_own_account');

    if (error) {
      console.error('❌ 계정 탈퇴 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`계정 탈퇴 실패: ${msg}`);
    }

    console.log('✅ 계정 탈퇴 완료');
  }

  // 어드민 지정/해제
  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ is_admin: isAdmin })
      .eq('id', userId);

    if (error) {
      console.error('어드민 설정 실패:', error);
      throw error;
    }
  }

  // 부어드민 지정/해제
  async setSubAdmin(userId: string, isSubAdmin: boolean): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ is_sub_admin: isSubAdmin })
      .eq('id', userId);

    if (error) {
      console.error('부어드민 설정 실패:', error);
      throw error;
    }
  }

  // 회원 상세 정보 조회 (PII 제외 — email/전화번호가 필요하면 searchUsers 사용)
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, profile_image, is_admin, is_super_admin, is_sub_admin, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('회원 조회 실패 상세:', JSON.stringify(error), error);
      return null;
    }

    return data;
  }
}

const userServiceInstance = new UserService();

export default userServiceInstance;
