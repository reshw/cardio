// authService.ts
// Supabase Auth (signInWithOAuth) 전환 이후 토큰 교환 로직은 제거됨.
// 카카오 OAuth 처리는 Supabase Auth가 담당하고,
// public.users 연결은 link_or_create_user RPC가 처리함.
// 프로필 업데이트 등 DB 직접 조작이 필요할 때만 이 서비스를 사용.

import { supabase } from '../lib/supabase';

class AuthService {
  // 사용자 프로필 업데이트 (닉네임·이미지 변경 등)
  async updateUserProfile(userId: string, updates: {
    display_name?: string;
    profile_image?: string;
    email?: string;
    phone_number?: string;
    birthyear?: string;
    gender?: string;
  }) {
    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
  }
}

export default new AuthService();
