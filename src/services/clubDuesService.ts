import { supabase } from '../lib/supabase';
import clubGradeService from './clubGradeService';

/**
 * 회비 납부 장부 — docs/design-guide_member-grade.md 10절
 * 한 번 낸 것이 한 행. 조회는 운영진(방장/부방장) + 본인만 (RLS).
 * 대회원/정회원은 이 기록으로 자동 계산된다 (올해 합계 5만원 기준).
 */

export const MAJOR_MEMBER_THRESHOLD = 50000; // 원 — 그 해 합계가 이 이상이면 대회원

export interface DuesPayment {
  id: string;
  club_id: string;
  user_id: string;
  season_year: number;
  paid_on: string; // YYYY-MM-DD
  amount: number; // 원
  memo: string | null;
  created_by: string;
  created_at: string;
}

/** 누적 합계(원) → 후원 단계 숫자 (5, 10, 20 … 100 …) */
export function donationStep(totalWon: number): number {
  const man = Math.floor(totalWon / 10000);
  if (man < 10) return 5;
  return Math.floor(man / 10) * 10;
}

/** 서울 기준 올해 */
export function currentSeasonYear(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()));
}

const clubDuesService = {
  async listPayments(clubId: string, opts: { year?: number; userId?: string } = {}): Promise<DuesPayment[]> {
    let q = supabase
      .from('club_dues_payments')
      .select('id, club_id, user_id, season_year, paid_on, amount, memo, created_by, created_at')
      .eq('club_id', clubId)
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (opts.year !== undefined) q = q.eq('season_year', opts.year);
    if (opts.userId) q = q.eq('user_id', opts.userId);

    const { data, error } = await q;
    if (error) {
      console.error('[회비] 납부 기록 조회 실패:', JSON.stringify(error), error);
      throw error;
    }
    return (data ?? []) as DuesPayment[];
  },

  async addPayment(params: {
    clubId: string;
    userId: string;
    createdBy: string;
    seasonYear: number;
    paidOn: string;
    amount: number;
    memo?: string;
  }): Promise<void> {
    const { error } = await supabase.from('club_dues_payments').insert({
      club_id: params.clubId,
      user_id: params.userId,
      created_by: params.createdBy,
      season_year: params.seasonYear,
      paid_on: params.paidOn,
      amount: params.amount,
      memo: params.memo?.trim() || null,
    });
    if (error) {
      console.error('[회비] 납부 기록 추가 실패:', JSON.stringify(error), error);
      throw error;
    }
    clubGradeService.invalidate(params.clubId);
  },

  async updatePayment(
    clubId: string,
    id: string,
    patch: { seasonYear: number; paidOn: string; amount: number; memo?: string }
  ): Promise<void> {
    const { error } = await supabase
      .from('club_dues_payments')
      .update({
        season_year: patch.seasonYear,
        paid_on: patch.paidOn,
        amount: patch.amount,
        memo: patch.memo?.trim() || null,
      })
      .eq('id', id);
    if (error) {
      console.error('[회비] 납부 기록 수정 실패:', JSON.stringify(error), error);
      throw error;
    }
    clubGradeService.invalidate(clubId);
  },

  async deletePayment(clubId: string, id: string): Promise<void> {
    const { error } = await supabase.from('club_dues_payments').delete().eq('id', id);
    if (error) {
      console.error('[회비] 납부 기록 삭제 실패:', JSON.stringify(error), error);
      throw error;
    }
    clubGradeService.invalidate(clubId);
  },
};

export default clubDuesService;
