import { supabase } from '../lib/supabase';

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
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
}

export default new UserService();
