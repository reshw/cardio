import { supabase } from '../lib/supabase';
import clubService from './clubService';

export type BuiltinRoleKey = 'manager' | 'vice-manager' | 'member';
export type PermissionKey = 'manage_events';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_events: '행사 관리 (등록/수정/삭제, 체크인 승인)',
};

export type RoleLabels = Record<BuiltinRoleKey, string>;

export const DEFAULT_ROLE_LABELS: RoleLabels = {
  manager: '클럽장',
  'vice-manager': '부클럽장',
  member: '회원',
};

export interface CustomRoleMember {
  user_id: string;
  nickname: string;
  profile_image?: string;
}

export interface CustomRole {
  id: string;
  club_id: string;
  name: string;
  sort_order: number;
  permissions: PermissionKey[];
  created_at: string;
  members: CustomRoleMember[];
}

interface CustomRoleRow {
  id: string;
  club_id: string;
  name: string;
  sort_order: number;
  permissions: string[];
  created_at: string;
}

const clubPermissionService = {
  async getRoleLabels(clubId: string): Promise<RoleLabels> {
    const { data, error } = await supabase
      .from('clubs')
      .select('role_labels')
      .eq('id', clubId)
      .single();

    if (error) {
      console.error('[권한관리] 등급 이름 조회 실패:', JSON.stringify(error), error);
      throw error;
    }

    return { ...DEFAULT_ROLE_LABELS, ...(data?.role_labels ?? {}) };
  },

  async updateRoleLabels(clubId: string, labels: RoleLabels): Promise<void> {
    const { error } = await supabase
      .from('clubs')
      .update({ role_labels: labels })
      .eq('id', clubId);

    if (error) {
      console.error('[권한관리] 등급 이름 수정 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  async listCustomRoles(clubId: string): Promise<CustomRole[]> {
    const { data: roles, error } = await supabase
      .from('club_custom_roles')
      .select('id, club_id, name, sort_order, permissions, created_at')
      .eq('club_id', clubId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[권한관리] 커스텀 등급 조회 실패:', JSON.stringify(error), error);
      throw error;
    }
    if (!roles || roles.length === 0) return [];

    const roleIds = roles.map((r) => r.id);
    const [{ data: memberRows, error: memberError }, members] = await Promise.all([
      supabase.from('club_custom_role_members').select('role_id, user_id').in('role_id', roleIds),
      clubService.getClubMembers(clubId),
    ]);

    if (memberError) {
      console.error('[권한관리] 등급 멤버 조회 실패:', JSON.stringify(memberError), memberError);
      throw memberError;
    }

    const nicknameMap = new Map(
      members.map((m) => [m.user_id, { nickname: m.club_nickname || m.user?.display_name || '회원', profileImage: m.club_profile_image || m.user?.profile_image }])
    );

    const membersByRole = new Map<string, CustomRoleMember[]>();
    for (const row of memberRows ?? []) {
      const info = nicknameMap.get(row.user_id);
      const list = membersByRole.get(row.role_id) ?? [];
      list.push({ user_id: row.user_id, nickname: info?.nickname ?? '회원', profile_image: info?.profileImage });
      membersByRole.set(row.role_id, list);
    }

    return (roles as CustomRoleRow[]).map((r) => ({
      ...r,
      permissions: (r.permissions ?? []) as PermissionKey[],
      members: membersByRole.get(r.id) ?? [],
    }));
  },

  async createCustomRole(params: {
    clubId: string;
    createdBy: string;
    name: string;
    permissions?: PermissionKey[];
    sortOrder?: number;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('club_custom_roles')
      .insert({
        club_id: params.clubId,
        created_by: params.createdBy,
        name: params.name,
        permissions: params.permissions ?? [],
        sort_order: params.sortOrder ?? 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[권한관리] 커스텀 등급 생성 실패:', JSON.stringify(error), error);
      throw error;
    }
    return data.id;
  },

  async updateCustomRole(roleId: string, params: { name?: string; permissions?: PermissionKey[]; sortOrder?: number }): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (params.name !== undefined) patch.name = params.name;
    if (params.permissions !== undefined) patch.permissions = params.permissions;
    if (params.sortOrder !== undefined) patch.sort_order = params.sortOrder;

    const { error } = await supabase.from('club_custom_roles').update(patch).eq('id', roleId);
    if (error) {
      console.error('[권한관리] 커스텀 등급 수정 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  async deleteCustomRole(roleId: string): Promise<void> {
    const { error } = await supabase.from('club_custom_roles').delete().eq('id', roleId);
    if (error) {
      console.error('[권한관리] 커스텀 등급 삭제 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  async addRoleMember(roleId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('club_custom_role_members').insert({ role_id: roleId, user_id: userId });
    if (error && error.code === '23505') return; // 이미 배정됨
    if (error) {
      console.error('[권한관리] 등급 멤버 추가 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  async removeRoleMember(roleId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('club_custom_role_members').delete().eq('role_id', roleId).eq('user_id', userId);
    if (error) {
      console.error('[권한관리] 등급 멤버 제거 실패:', JSON.stringify(error), error);
      throw error;
    }
  },
};

export default clubPermissionService;
