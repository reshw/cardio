import { supabase } from '../lib/supabase';
import { DEFAULT_ROLE_LABELS, type RoleLabels } from './clubPermissionService';

/**
 * 회원 등급 배지 — 설계: docs/design-guide_member-grade.md
 *
 * 사다리: 방장 > 부방장 > 커스텀 직책(badge_style='title', sort_order 순) > 대회원 > 정회원 > 없음
 * 한 사람 한 배지. 회비 등급(대/정회원)은 커스텀 등급이 아니라 납부 기록에서 자동 계산된다.
 */

export type GradeKind = 'manager' | 'vice' | 'title' | 'tier_strong' | 'tier_soft';
export type GradeIcon = 'run' | 'bike' | 'swim' | 'hike';

export interface MemberGrade {
  kind: GradeKind;
  label: string;
  icon?: GradeIcon | null;
  /** 대회원 누적 후원 단계 (만원). 5, 10, 20 … 100 … */
  step?: number;
  /** 회비 등급의 연도 (예: 2027) */
  year?: number;
}

export const GRADE_ICON_LABELS: Record<GradeIcon, string> = {
  run: '달리기',
  bike: '사이클',
  swim: '수영',
  hike: '등산',
};

export type GradeMap = Map<string, MemberGrade>;

interface CustomRoleRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  badge_icon: GradeIcon | null;
}

interface DuesBadgeRow {
  user_id: string;
  season_year: number;
  tier: 'strong' | 'soft';
  step: number | null;
}

const yy = (year: number) => String(year % 100).padStart(2, '0');

async function fetchGradeMap(clubId: string): Promise<GradeMap> {
  const [clubRes, staffRes, rolesRes, duesRes] = await Promise.all([
    supabase.from('clubs').select('role_labels').eq('id', clubId).single(),
    supabase.from('club_members').select('user_id, role').eq('club_id', clubId).in('role', ['manager', 'vice-manager']),
    supabase
      .from('club_custom_roles')
      .select('id, name, sort_order, created_at, badge_icon')
      .eq('club_id', clubId)
      .eq('badge_style', 'title'),
    supabase.rpc('get_club_dues_badges', { p_club_id: clubId }),
  ]);

  for (const [step, res] of [
    ['호칭', clubRes],
    ['운영진', staffRes],
    ['커스텀 등급', rolesRes],
    ['회비 배지', duesRes],
  ] as const) {
    if (res.error) {
      console.error(`[등급] ${step} 조회 실패:`, JSON.stringify(res.error), res.error);
      throw res.error;
    }
  }

  const labels: RoleLabels = { ...DEFAULT_ROLE_LABELS, ...(clubRes.data?.role_labels ?? {}) };
  const map: GradeMap = new Map();

  // 사다리 아래에서 위로 채워 위 등급이 덮어쓰게 한다.

  // 5·4. 회비 등급
  for (const row of (duesRes.data ?? []) as DuesBadgeRow[]) {
    map.set(
      row.user_id,
      row.tier === 'strong'
        ? { kind: 'tier_strong', label: `${yy(row.season_year)} 대회원`, step: row.step ?? 5, year: row.season_year }
        : { kind: 'tier_soft', label: `${yy(row.season_year)} 정회원`, year: row.season_year }
    );
  }

  // 3. 커스텀 직책 — sort_order 오름차순(같으면 created_at)에서 가장 위 하나
  const roles = ((rolesRes.data ?? []) as CustomRoleRow[]).sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
  );
  if (roles.length > 0) {
    const { data: memberRows, error } = await supabase
      .from('club_custom_role_members')
      .select('role_id, user_id')
      .in('role_id', roles.map((r) => r.id));
    if (error) {
      console.error('[등급] 커스텀 등급 배정 조회 실패:', JSON.stringify(error), error);
      throw error;
    }
    const rank = new Map(roles.map((r, i) => [r.id, i]));
    const best = new Map<string, CustomRoleRow>();
    for (const row of memberRows ?? []) {
      const role = roles[rank.get(row.role_id)!];
      const prev = best.get(row.user_id);
      if (!prev || rank.get(role.id)! < rank.get(prev.id)!) best.set(row.user_id, role);
    }
    for (const [userId, role] of best) {
      map.set(userId, { kind: 'title', label: role.name, icon: role.badge_icon });
    }
  }

  // 2·1. 운영진 — 현재 회원 목록에서 온 것이라 탈퇴자는 자연히 빠진다
  for (const m of staffRes.data ?? []) {
    map.set(
      m.user_id,
      m.role === 'manager'
        ? { kind: 'manager', label: labels.manager }
        : { kind: 'vice', label: labels['vice-manager'] }
    );
  }

  // 커스텀 직책·회비 등급은 현재 회원에게만 — 운영진/회비 RPC 는 이미 회원만 돌려준다.
  // 커스텀 배정은 탈퇴 시 트리거로 지워지므로 별도 필터 불필요.
  return map;
}

// ── 캐시 — 랭킹·피드·상세가 같은 맵을 공유한다 ────────────────
const cache = new Map<string, Promise<GradeMap>>();
const listeners = new Set<(clubId: string) => void>();

const clubGradeService = {
  getGradeMap(clubId: string): Promise<GradeMap> {
    let p = cache.get(clubId);
    if (!p) {
      p = fetchGradeMap(clubId).catch((err) => {
        cache.delete(clubId);
        throw err;
      });
      cache.set(clubId, p);
    }
    return p;
  },

  /** 권한관리·회비 관리에서 고친 뒤 호출 — 열려 있는 화면들이 다시 불러온다 */
  invalidate(clubId: string) {
    cache.delete(clubId);
    listeners.forEach((fn) => fn(clubId));
  },

  subscribe(fn: (clubId: string) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export default clubGradeService;
