// src/services/authService.ts
import { supabase } from '../lib/supabase';

export interface KakaoUserInfo {
  id: string;
  email: string;
  displayName: string;
  nickname: string;
  profileImage: string;
  birthyear?: string;
  gender?: string;
  phoneNumber?: string;
}

class AuthService {
  private readonly KAUTH_BASE = 'https://kauth.kakao.com';
  private readonly KAPI_BASE = 'https://kapi.kakao.com';

  // 환경 변수 검증
  private requireEnv(key: string): string {
    const value = import.meta.env[key];
    if (!value) {
      throw new Error(`환경변수 ${key}가 설정되어 있지 않습니다.`);
    }
    return value;
  }

  // POST 요청 헬퍼
  private async postForm(url: string, params: Record<string, string>): Promise<Response> {
    const body = new URLSearchParams(params).toString();
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  }

  // 응답 검증
  private async assertOk(res: Response, label: string): Promise<void> {
    if (!res.ok) {
      let text = '';
      try {
        text = await res.text();
      } catch {}
      throw new Error(`${label} 실패(${res.status}). ${text || ''}`.trim());
    }
  }

  // 1. 카카오 인가 코드 → 토큰 → 사용자 정보
  async getKakaoUserInfo(code: string): Promise<KakaoUserInfo> {
    if (!code) {
      throw new Error('인가 코드(code)가 없습니다.');
    }

    const REST_API_KEY = this.requireEnv('VITE_KAKAO_REST_API_KEY');
    const currentOrigin = window.location.origin;
    const REDIRECT_URI = `${currentOrigin}/auth/kakao/callback`;
    const CLIENT_SECRET = import.meta.env.VITE_KAKAO_CLIENT_SECRET || '';

    console.log('🔑 토큰 교환용 리다이렉트 URI:', REDIRECT_URI);

    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: REST_API_KEY,
      redirect_uri: REDIRECT_URI,
      code,
    };

    if (CLIENT_SECRET) {
      tokenParams.client_secret = CLIENT_SECRET;
    }

    const tokenRes = await this.postForm(`${this.KAUTH_BASE}/oauth/token`, tokenParams);
    await this.assertOk(tokenRes, '토큰 교환');
    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson?.access_token;

    if (!accessToken) {
      throw new Error('토큰 교환은 성공했으나 access_token이 없습니다.');
    }

    return await this.getKakaoUserInfoFromAccessToken(accessToken);
  }

  // 2. Access Token으로 사용자 정보 조회
  async getKakaoUserInfoFromAccessToken(accessToken: string): Promise<KakaoUserInfo> {
    if (!accessToken) {
      throw new Error('access_token이 없습니다.');
    }

    const meRes = await fetch(`${this.KAPI_BASE}/v2/user/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    await this.assertOk(meRes, '카카오 사용자 정보 조회');
    const data = await meRes.json();

    const id = data?.id;
    if (!id) {
      throw new Error('카카오 응답에 사용자 ID가 없습니다.');
    }

    const account = data?.kakao_account || {};
    const profile = account?.profile || {};

    const name = account?.name || '';
    const nickname = profile?.nickname || '';
    const gender = account?.gender || '';
    const birthyear = account?.birthyear || '';
    const phoneNumber = account?.phone_number || '';

    return {
      id: String(id),
      email: account?.email || '',
      displayName: name || nickname || '사용자',
      nickname,
      gender,
      birthyear,
      phoneNumber,
      profileImage: profile?.profile_image_url || '',
    };
  }

  // 3. Supabase: 카카오 ID로 사용자 존재 여부 확인
  async checkUserExistsByKakaoId(kakaoId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('kakao_id', kakaoId)
      .maybeSingle();

    if (error) {
      console.error('사용자 존재 확인 에러:', error);
      // PGRST116: 결과 없음 (정상)
      // PGRST301: RLS 정책으로 인한 권한 에러
      // 이 경우 신규 사용자로 간주
      if (error.code === 'PGRST116' || error.code === 'PGRST301') {
        return false;
      }
      throw error;
    }

    return !!data;
  }

  // 4. Supabase: 카카오 사용자 정보로 회원가입
  async registerKakaoUser(kakaoInfo: KakaoUserInfo) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: `kakao_${kakaoInfo.id}`,
        display_name: kakaoInfo.displayName,
        email: kakaoInfo.email,
        kakao_id: kakaoInfo.id,
        provider: 'kakao',
        profile_image: kakaoInfo.profileImage,
        phone_number: kakaoInfo.phoneNumber || null,
        birthyear: kakaoInfo.birthyear || null,
        gender: kakaoInfo.gender || null,
      })
      .select()
      .single();

    if (error) {
      console.error('회원가입 실패:', error);
      throw error;
    }

    return data;
  }

  // 5. Supabase: 카카오 ID로 사용자 조회
  async getUserByKakaoId(kakaoId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, email, kakao_id, provider, profile_image')
      .eq('kakao_id', kakaoId)
      .single();

    if (error) {
      console.error('사용자 조회 실패:', error);
      throw error;
    }

    return data;
  }

  // 6. Supabase: 사용자 프로필 업데이트
  async updateUserProfile(kakaoId: string, profileData: Partial<KakaoUserInfo>) {
    const updates: Record<string, any> = {};

    if (profileData.displayName !== undefined) {
      updates.display_name = profileData.displayName;
    }
    if (profileData.nickname !== undefined) {
      updates.nickname = profileData.nickname;
    }
    if (profileData.profileImage !== undefined) {
      updates.profile_image = profileData.profileImage;
    }
    if (profileData.email !== undefined) {
      updates.email = profileData.email;
    }
    if (profileData.phoneNumber !== undefined) {
      updates.phone_number = profileData.phoneNumber;
    }
    if (profileData.birthyear !== undefined) {
      updates.birthyear = profileData.birthyear;
    }
    if (profileData.gender !== undefined) {
      updates.gender = profileData.gender;
    }

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('kakao_id', kakaoId);

    if (error) {
      console.error('프로필 업데이트 실패:', error);
      throw error;
    }
  }
}

export default new AuthService();
