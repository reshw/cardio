import { supabase } from '../lib/supabase';

// ============================================
// 클럽 월별 시상 이력 (club_awards)
//
// 상 종류는 클럽마다 다르므로 컬럼으로 고정하지 않고 tags(키워드 배열)로 둔다.
// 설계: docs/plans/club-awards.md
// ============================================

export interface ClubAward {
  id: string;
  club_id: string;
  year: number;
  month: number;
  user_id: string;
  tags: string[];
  awarded_by: string | null;
  created_at: string;
  /** 조인 결과 — 클럽 닉네임 우선, 없으면 users.display_name */
  display_name?: string;
}

// 이 클럽에서 이미 쓴 적 있는 키워드 (입력 시 추천용)
export type TagSuggestions = string[];

class ClubAwardService {
  private async attachNames(clubId: string, rows: ClubAward[]): Promise<ClubAward[]> {
    if (rows.length === 0) return rows;
    const userIds = [...new Set(rows.map(r => r.user_id))];

    const [{ data: members }, { data: users }] = await Promise.all([
      supabase
        .from('club_members')
        .select('user_id, club_nickname')
        .eq('club_id', clubId)
        .in('user_id', userIds),
      supabase.from('users').select('id, display_name').in('id', userIds),
    ]);

    const nickMap = Object.fromEntries((members || []).map((m: any) => [m.user_id, m.club_nickname]));
    const nameMap = Object.fromEntries((users || []).map((u: any) => [u.id, u.display_name]));

    return rows.map(r => ({
      ...r,
      display_name: nickMap[r.user_id] || nameMap[r.user_id] || '(이름 없음)',
    }));
  }

  /** 월별 수상자. 연월을 생략하면 클럽 전체 이력(최신순). */
  async getAwards(clubId: string, period?: { year: number; month: number }): Promise<ClubAward[]> {
    let query = supabase
      .from('club_awards')
      .select('*')
      .eq('club_id', clubId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('created_at', { ascending: true });

    if (period) query = query.eq('year', period.year).eq('month', period.month);

    const { data, error } = await query;
    if (error) {
      console.error('[시상] 목록 조회 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`시상 이력 조회 실패: ${msg}`);
    }
    return this.attachNames(clubId, (data || []) as ClubAward[]);
  }

  /**
   * 특정 회원의 수상 이력 (최신순).
   * 지금 UI 에선 안 쓰지만, "지난달 수상자는 이번달 제외" 같은 규칙을 나중에
   * 세울 때 이 조회가 근거가 된다 — 이 기능의 목적 자체가 그 관리 변수화다.
   */
  async getAwardsByUser(clubId: string, userId: string, limit = 12): Promise<ClubAward[]> {
    const { data, error } = await supabase
      .from('club_awards')
      .select('*')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[시상] 회원별 이력 조회 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`회원 수상 이력 조회 실패: ${msg}`);
    }
    return (data || []) as ClubAward[];
  }

  /** 이 클럽이 지금까지 쓴 키워드 목록 (입력 시 추천용) */
  async getUsedTags(clubId: string): Promise<TagSuggestions> {
    const { data, error } = await supabase
      .from('club_awards')
      .select('tags')
      .eq('club_id', clubId)
      .limit(500);

    if (error) {
      console.error('[시상] 키워드 조회 실패 상세:', JSON.stringify(error), error);
      return [];
    }
    const set = new Set<string>();
    (data || []).forEach((r: any) => (r.tags || []).forEach((t: string) => set.add(t)));
    return [...set].sort();
  }

  /** 수상자 기록. 같은 달 같은 사람이 이미 있으면 tags 를 덮어쓴다. */
  async upsertAward(params: {
    clubId: string;
    year: number;
    month: number;
    userId: string;
    tags: string[];
    awardedBy: string;
  }): Promise<void> {
    const { error } = await supabase.from('club_awards').upsert(
      {
        club_id: params.clubId,
        year: params.year,
        month: params.month,
        user_id: params.userId,
        tags: params.tags,
        awarded_by: params.awardedBy,
      },
      { onConflict: 'club_id,year,month,user_id' }
    );

    if (error) {
      console.error('[시상] 기록 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`시상 기록 실패: ${msg}`);
    }
  }

  async deleteAward(id: string): Promise<void> {
    const { error } = await supabase.from('club_awards').delete().eq('id', id);
    if (error) {
      console.error('[시상] 삭제 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`시상 기록 삭제 실패: ${msg}`);
    }
  }
}

export default new ClubAwardService();
