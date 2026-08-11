import { supabase } from '../lib/supabase';
import clubService from './clubService';

// ============================================
// 팀 대항전 (team_match) 서비스
// 팀 이름은 색깔 기반(홍/백/청/흑), 경쟁 지표는 1인당 평균 마일리지
// 매치는 단일 월 → 기존 get_club_mileage_summary RPC 재사용
// ============================================

export interface TeamColorPreset {
  name: string;
  color: string;      // 식별 색 (hex)
  needsBorder: boolean; // 밝은 색이라 UI에서 테두리 필요 (백)
}

// 팀 수에 따라 앞에서부터 사용: 2팀 → 홍/백, 3팀 → +청, 4팀 → +흑
export const TEAM_PRESETS: TeamColorPreset[] = [
  { name: '홍팀', color: '#dc2626', needsBorder: false },
  { name: '백팀', color: '#e2e8f0', needsBorder: true },
  { name: '청팀', color: '#2563eb', needsBorder: false },
  { name: '흑팀', color: '#1f2937', needsBorder: false },
];

export interface ChallengeTeam {
  id: string;
  challenge_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface ChallengeTeamMember {
  id: string;
  team_id: string;
  challenge_id: string;
  user_id: string;
  is_captain: boolean;
  joined_via: 'auto' | 'self' | 'admin';
  created_at: string;
}

export interface TeamMatchMeta {
  metric: 'avg_mileage';
  baseline_months: number;
  avg_denominator: 'recorded' | 'all';
}

export const DEFAULT_TEAM_MATCH_META: TeamMatchMeta = {
  metric: 'avg_mileage',
  baseline_months: 3,
  avg_denominator: 'recorded',
};

// 팀 순위 한 줄
export interface TeamStanding {
  team: ChallengeTeam;
  memberCount: number;      // 배정 인원
  recordedCount: number;    // 기록 보유 인원 (mileage > 0)
  totalMileage: number;     // 팀 합산 마일리지
  avgMileage: number;       // 1인당 평균 (분모 정책 반영)
  rank: number;
}

// 'YYYY-MM-DD' → { year, month }
const monthOf = (dateStr: string): { year: number; month: number } => {
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y, month: m };
};

// (year, month)에서 n개월 전
const shiftMonth = (year: number, month: number, back: number): { year: number; month: number } => {
  const total = year * 12 + (month - 1) - back;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
};

type MileageRow = { user_id: string; total_mileage: number; workout_count: number };

const teamMatchService = {
  TEAM_PRESETS,

  // 매치 월 마일리지 합산 (스냅샷 없으면 재계산 후 재조회)
  async _fetchMonthMileage(clubId: string, year: number, month: number): Promise<MileageRow[]> {
    const { data, error } = await supabase.rpc('get_club_mileage_summary', {
      p_club_id: clubId,
      p_year: year,
      p_month: month,
    });
    if (error) throw error;
    if (data && data.length > 0) return data as MileageRow[];

    // 스냅샷 없음 → 재계산 후 재조회
    await clubService.recalculateClubMonthMileage(clubId, year, month).catch(() => {});
    const { data: refreshed } = await supabase.rpc('get_club_mileage_summary', {
      p_club_id: clubId,
      p_year: year,
      p_month: month,
    });
    return (refreshed || []) as MileageRow[];
  },

  // 팀 + 팀원 조회
  async getTeamsWithMembers(
    challengeId: string
  ): Promise<{ teams: ChallengeTeam[]; members: ChallengeTeamMember[] }> {
    const [{ data: teams }, { data: members }] = await Promise.all([
      supabase
        .from('challenge_teams')
        .select('*')
        .eq('challenge_id', challengeId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('challenge_team_members')
        .select('*')
        .eq('challenge_id', challengeId),
    ]);
    return { teams: (teams || []) as ChallengeTeam[], members: (members || []) as ChallengeTeamMember[] };
  },

  // 팀 생성 (챌린지 생성 직후, 매니저)
  async createTeams(
    challengeId: string,
    teams: { name: string; color: string }[]
  ): Promise<ChallengeTeam[]> {
    const rows = teams.map((t, i) => ({
      challenge_id: challengeId,
      name: t.name,
      color: t.color,
      sort_order: i,
    }));
    console.log('[team_match] createTeams 시도:', challengeId, JSON.stringify(rows));
    const { data, error } = await supabase.from('challenge_teams').insert(rows).select();
    if (error) {
      console.error('[team_match] createTeams INSERT 실패:', JSON.stringify(error), error);
      throw error;
    }
    console.log('[team_match] createTeams OK, 생성된 팀 수=', data?.length, JSON.stringify(data));
    return (data || []) as ChallengeTeam[];
  },

  // 최근 baseline_months 개월 마일리지 합산 (드래프트 기준 / 배정 미리보기용)
  async getBaselineMileage(
    clubId: string,
    startDate: string,
    baselineMonths = 3
  ): Promise<Record<string, number>> {
    const { year, month } = monthOf(startDate);
    const sumByUser: Record<string, number> = {};
    for (let back = 1; back <= baselineMonths; back++) {
      const { year: y, month: m } = shiftMonth(year, month, back);
      const rows = await this._fetchMonthMileage(clubId, y, m);
      rows.forEach((r) => {
        sumByUser[r.user_id] = (sumByUser[r.user_id] || 0) + Number(r.total_mileage || 0);
      });
    }
    return sumByUser;
  },

  // 스네이크 드래프트 계산: 최근 baseline_months 개월 평균 내림차순 → 지그재그 배정
  //   기록 보유자만 자동 배정, 무기록자는 제외(자율 선택 대상)
  async computeSnakeDraft(
    clubId: string,
    startDate: string,
    teams: ChallengeTeam[],
    baselineMonths = 3
  ): Promise<{ user_id: string; team_id: string }[]> {
    const sumByUser = await this.getBaselineMileage(clubId, startDate, baselineMonths);

    // 기록 보유자만, 내림차순 정렬
    const ranked = Object.entries(sumByUser)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([userId]) => userId);

    const n = teams.length;
    return ranked.map((userId, i) => {
      const round = Math.floor(i / n);
      const pos = i % n;
      const teamIdx = round % 2 === 0 ? pos : n - 1 - pos;
      return { user_id: userId, team_id: teams[teamIdx].id };
    });
  },

  // 배정 저장 (기존 배정 전체 교체 — 매니저 드래프트/재배정)
  async replaceAssignments(
    challengeId: string,
    assignments: { user_id: string; team_id: string; is_captain?: boolean; joined_via?: 'auto' | 'self' | 'admin' }[]
  ): Promise<void> {
    // 기존 팀원 전체 삭제 후 재삽입
    const { error: delErr } = await supabase
      .from('challenge_team_members')
      .delete()
      .eq('challenge_id', challengeId);
    if (delErr) throw delErr;

    if (assignments.length === 0) return;
    const rows = assignments.map((a) => ({
      challenge_id: challengeId,
      team_id: a.team_id,
      user_id: a.user_id,
      is_captain: a.is_captain ?? false,
      joined_via: a.joined_via ?? 'auto',
    }));
    const { error } = await supabase.from('challenge_team_members').insert(rows);
    if (error) throw error;
  },

  // 팀원 1명 팀 이동 (매니저 수동 조정)
  async moveMember(challengeId: string, userId: string, teamId: string): Promise<void> {
    const { error } = await supabase
      .from('challenge_team_members')
      .update({ team_id: teamId, joined_via: 'admin' })
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // 본인 자율 팀 선택 (무기록자/신입)
  async joinTeamSelf(challengeId: string, teamId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('challenge_team_members').insert({
      challenge_id: challengeId,
      team_id: teamId,
      user_id: userId,
      joined_via: 'self',
    });
    if (error) throw error;
  },

  // 내 소속 팀 (미배정이면 null)
  async getMyMembership(challengeId: string, userId: string): Promise<ChallengeTeamMember | null> {
    const { data } = await supabase
      .from('challenge_team_members')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle();
    return (data as ChallengeTeamMember) || null;
  },

  // 팀 순위 (매치 월 1인당 평균 마일리지)
  async getStandings(
    challenge: { id: string; club_id: string | null; start_date: string; meta_data?: any },
    denominator: 'recorded' | 'all' = 'recorded'
  ): Promise<{ standings: TeamStanding[]; mileageByUser: Record<string, number> }> {
    if (!challenge.club_id) return { standings: [], mileageByUser: {} };

    const { teams, members } = await this.getTeamsWithMembers(challenge.id);
    const { year, month } = monthOf(challenge.start_date);
    const rows = await this._fetchMonthMileage(challenge.club_id, year, month);

    const mileageByUser: Record<string, number> = {};
    rows.forEach((r) => { mileageByUser[r.user_id] = Number(r.total_mileage || 0); });

    const standings: TeamStanding[] = teams.map((team) => {
      const teamMembers = members.filter((m) => m.team_id === team.id);
      const recorded = teamMembers.filter((m) => (mileageByUser[m.user_id] || 0) > 0);
      const totalMileage = teamMembers.reduce((s, m) => s + (mileageByUser[m.user_id] || 0), 0);
      const denom = denominator === 'all' ? teamMembers.length : recorded.length;
      const avgMileage = denom > 0 ? Math.round((totalMileage / denom) * 10) / 10 : 0;
      return {
        team,
        memberCount: teamMembers.length,
        recordedCount: recorded.length,
        totalMileage: Math.round(totalMileage * 10) / 10,
        avgMileage,
        rank: 0,
      };
    });

    standings.sort((a, b) => b.avgMileage - a.avgMileage);
    standings.forEach((s, i) => { s.rank = i + 1; });

    return { standings, mileageByUser };
  },

  // 매치 상세 (카드 렌더용): 팀 순위 + 팀별 팀원(닉네임·마일리지) + 내 소속
  async getMatchDetail(
    challenge: { id: string; club_id: string | null; start_date: string; meta_data?: any },
    userId: string
  ): Promise<{
    teams: ChallengeTeam[];
    standings: TeamStanding[];
    membersByTeam: Record<string, { user_id: string; name: string; mileage: number; is_captain: boolean }[]>;
    myTeamId: string | null;
    myMileage: number;
    unassignedCount: number;
  }> {
    const meta = this.parseMeta(challenge.meta_data);
    const { teams, members } = await this.getTeamsWithMembers(challenge.id);
    const { standings, mileageByUser } = await this.getStandings(challenge, meta.avg_denominator);

    // 닉네임 조회
    const userIds = members.map((m) => m.user_id);
    let nameMap: Record<string, string> = {};
    if (userIds.length > 0 && challenge.club_id) {
      const { data: cm } = await supabase
        .from('club_members')
        .select('user_id, club_nickname')
        .eq('club_id', challenge.club_id)
        .in('user_id', userIds);
      nameMap = Object.fromEntries((cm || []).map((m: any) => [m.user_id, m.club_nickname || '(이름 없음)']));
    }

    const membersByTeam: Record<string, { user_id: string; name: string; mileage: number; is_captain: boolean }[]> = {};
    teams.forEach((t) => { membersByTeam[t.id] = []; });
    members.forEach((m) => {
      if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = [];
      membersByTeam[m.team_id].push({
        user_id: m.user_id,
        name: nameMap[m.user_id] || '(이름 없음)',
        mileage: Math.round((mileageByUser[m.user_id] || 0) * 10) / 10,
        is_captain: m.is_captain,
      });
    });
    Object.values(membersByTeam).forEach((list) => list.sort((a, b) => b.mileage - a.mileage));

    const mine = members.find((m) => m.user_id === userId);

    return {
      teams,
      standings,
      membersByTeam,
      myTeamId: mine?.team_id || null,
      myMileage: Math.round((mileageByUser[userId] || 0) * 10) / 10,
      unassignedCount: 0, // 미배정 수는 클럽 전체 대비라 카드에서 계산 안 함
    };
  },

  // 종료 매치 결과·시상 (우승팀 / MVP / 아차상)
  async getMatchResults(
    challenge: { id: string; club_id: string | null; start_date: string; meta_data?: any },
    userId: string
  ): Promise<{
    winner: TeamStanding | null;
    mvp: { name: string; mileage: number; teamName: string; teamColor: string } | null;
    comeback: { name: string; growthPct: number; teamName: string; teamColor: string } | null;
  } | null> {
    if (!challenge.club_id) return null;
    const meta = this.parseMeta(challenge.meta_data);
    const detail = await this.getMatchDetail(challenge, userId);
    if (detail.standings.length === 0) return null;

    const winner = detail.standings[0];
    const teamById = Object.fromEntries(detail.teams.map((t) => [t.id, t]));

    // 명예의 전당 제외 대상
    const memberUserIds: string[] = [];
    Object.values(detail.membersByTeam).forEach((list) => list.forEach((m) => memberUserIds.push(m.user_id)));
    let hofSet = new Set<string>();
    if (memberUserIds.length > 0) {
      const { data: hof } = await supabase
        .from('hall_of_fame')
        .select('user_id')
        .eq('club_id', challenge.club_id)
        .in('user_id', memberUserIds);
      hofSet = new Set((hof || []).map((h: any) => h.user_id));
    }

    // MVP: 패배 팀 소속 중 개인 마일리지 최고 (명전 제외)
    let mvp: { name: string; mileage: number; teamName: string; teamColor: string } | null = null;
    detail.teams.forEach((t) => {
      if (t.id === winner.team.id) return; // 우승팀 제외 → 패배 팀만
      (detail.membersByTeam[t.id] || []).forEach((m) => {
        if (hofSet.has(m.user_id)) return;
        if (!mvp || m.mileage > mvp.mileage) {
          mvp = { name: m.name, mileage: m.mileage, teamName: t.name, teamColor: t.color };
        }
      });
    });

    // 아차상: 직전 baseline개월 대비 매치 기간 성장률 최고 (기록 있던 사람만)
    const baseline = await this.getBaselineMileage(challenge.club_id, challenge.start_date, meta.baseline_months);
    let comeback: { name: string; growthPct: number; teamName: string; teamColor: string } | null = null;
    Object.entries(detail.membersByTeam).forEach(([teamId, list]) => {
      const t = teamById[teamId];
      list.forEach((m) => {
        const baseMonthly = (baseline[m.user_id] || 0) / meta.baseline_months;
        if (baseMonthly <= 0 || m.mileage <= 0) return; // 무기록/신규는 성장률 산정 제외
        const growthPct = Math.round(((m.mileage - baseMonthly) / baseMonthly) * 100);
        if (!comeback || growthPct > comeback.growthPct) {
          comeback = { name: m.name, growthPct, teamName: t?.name || '', teamColor: t?.color || '#999' };
        }
      });
    });

    return { winner, mvp, comeback };
  },

  // 진행 중인 팀 대항전의 유저별 팀 색상 뱃지 (마일리지 랭킹 표식용)
  //   진행 중 매치 없으면 빈 객체 → 랭킹에 아무 표식 없음
  async getActiveTeamBadges(
    clubId: string
  ): Promise<Record<string, { color: string; name: string }>> {
    const today = new Date().toISOString().split('T')[0];
    const { data: matches } = await supabase
      .from('challenges')
      .select('id')
      .eq('club_id', clubId)
      .eq('challenge_type', 'team_match')
      .eq('status', 'active')
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1);

    if (!matches || matches.length === 0) return {};

    const { teams, members } = await this.getTeamsWithMembers(matches[0].id);
    const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
    const badges: Record<string, { color: string; name: string }> = {};
    members.forEach((m) => {
      const t = teamMap[m.team_id];
      if (t) badges[m.user_id] = { color: t.color, name: t.name };
    });
    return badges;
  },

  // meta에서 팀매치 설정 파싱
  parseMeta(meta_data: any): TeamMatchMeta {
    const tm = meta_data?.team_match;
    if (!tm) return DEFAULT_TEAM_MATCH_META;
    return {
      metric: 'avg_mileage',
      baseline_months: tm.baseline_months ?? DEFAULT_TEAM_MATCH_META.baseline_months,
      avg_denominator: tm.avg_denominator ?? DEFAULT_TEAM_MATCH_META.avg_denominator,
    };
  },
};

export default teamMatchService;
