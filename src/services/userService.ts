import { supabase } from '../lib/supabase';

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
}

export interface User {
  id: string;
  email?: string;
  display_name: string;
  profile_image?: string;
  phone_number?: string;
  is_admin: boolean;
  is_sub_admin: boolean;
  created_at: string;
  last_login?: string;
}

class UserService {
  // 모든 어드민 사용자 조회
  async getAdminUsers(): Promise<AdminUser[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, display_name, is_admin')
      .eq('is_admin', true);

    if (error) {
      console.error('어드민 사용자 조회 실패:', error);
      return [];
    }

    // email이 없는 어드민은 제외
    return (data || []).filter((user) => user.email);
  }

  // 어드민 이메일 목록 조회
  async getAdminEmails(): Promise<string[]> {
    const admins = await this.getAdminUsers();
    return admins.map((admin) => admin.email).filter(Boolean);
  }

  // 모든 회원 조회 (어드민용)
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('회원 목록 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  // 회원 검색 (실명, 전화번호)
  async searchUsers(query: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`display_name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('회원 검색 실패:', error);
      throw error;
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

  // 회원 상세 정보 조회
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('회원 조회 실패:', error);
      return null;
    }

    return data;
  }
}

const userServiceInstance = new UserService();

export default userServiceInstance;
