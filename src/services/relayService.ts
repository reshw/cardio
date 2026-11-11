import { supabase } from '../lib/supabase';
import clubService from './clubService';
import { RELAY_COURSES, getRelayLegs } from '../data/relayCourses';

// 클럽 이어달리기 (서울 → 부산 등) — 바통 방식, 자율 인증.
// 테이블/RPC: supabase/migrations/20261111000000_club_relay.sql

export interface RelayChallenge {
  id: string;
  club_id: string;
  course_key: string;
  title: string;
  leg_count: number;
  status: 'active' | 'finished' | 'cancelled';
  started_by: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface RelayLegRecord {
  id: string;
  relay_id: string;
  leg_no: number;
  user_id: string;
  workout_id: string | null;
  note: string | null;
  created_at: string;
  // 조회 시 채움
  runnerName?: string;
  runnerImage?: string | null;
  workoutKm?: number | null;
}

export interface MyRunCandidate {
  id: string;
  value: number;
  unit: string;
  sub_type: string | null;
  workout_time: string;
}

const errText = (err: any) => err?.message || err?.details || err?.hint || JSON.stringify(err);

class RelayService {
  /** 진행 중(없으면 가장 최근 완주한) 이어달리기 */
  async getCurrentRelay(clubId: string): Promise<RelayChallenge | null> {
    const { data, error } = await supabase
      .from('relay_challenges')
      .select('*')
      .eq('club_id', clubId)
      .in('status', ['active', 'finished'])
      .order('started_at', { ascending: false })
      .limit(5);
    if (error) {
      console.error('[이어달리기] 조회 실패:', JSON.stringify(error), error);
      throw error;
    }
    const rows = (data || []) as RelayChallenge[];
    return rows.find((r) => r.status === 'active') ?? rows[0] ?? null;
  }

  async getLegs(relay: RelayChallenge): Promise<RelayLegRecord[]> {
    const { data, error } = await supabase
      .from('relay_legs')
      .select('*')
      .eq('relay_id', relay.id)
      .order('leg_no', { ascending: true });
    if (error) {
      console.error('[이어달리기] 구간 기록 조회 실패:', JSON.stringify(error), error);
      throw error;
    }
    const legs = (data || []) as RelayLegRecord[];
    if (legs.length === 0) return legs;

    // 이름(클럽 닉네임 우선) + 연결된 운동 km — 부가 정보라 실패해도 목록은 보여준다
    const [members, workouts] = await Promise.all([
      clubService.getClubMembers(relay.club_id).catch((err) => {
        console.error('[이어달리기] 멤버 이름 조회 실패:', JSON.stringify(err), err);
        return [];
      }),
      (async () => {
        const ids = legs.map((l) => l.workout_id).filter(Boolean) as string[];
        if (ids.length === 0) return [] as { id: string; value: number; unit: string }[];
        const { data: w, error: wErr } = await supabase.from('workouts').select('id, value, unit').in('id', ids);
        if (wErr) console.error('[이어달리기] 연결 운동 조회 실패:', JSON.stringify(wErr), wErr);
        return (w || []) as { id: string; value: number; unit: string }[];
      })(),
    ]);
    const nameMap = new Map<string, { name: string; image: string | null }>();
    (members as any[]).forEach((m) =>
      nameMap.set(m.user_id, {
        name: m.club_nickname || m.user?.display_name || m.display_name || '회원',
        image: m.club_profile_image || m.user?.profile_image || m.profile_image || null,
      })
    );
    const kmMap = new Map(workouts.map((w) => [w.id, w.unit === 'km' ? Number(w.value) : null]));
    return legs.map((l) => ({
      ...l,
      runnerName: nameMap.get(l.user_id)?.name ?? '(탈퇴 회원)',
      runnerImage: nameMap.get(l.user_id)?.image ?? null,
      workoutKm: l.workout_id ? kmMap.get(l.workout_id) ?? null : null,
    }));
  }

  async startRelay(clubId: string, courseKey: string, startedBy: string): Promise<RelayChallenge> {
    const course = RELAY_COURSES[courseKey];
    if (!course) throw new Error(`알 수 없는 코스: ${courseKey}`);
    const { data, error } = await supabase
      .from('relay_challenges')
      .insert({
        club_id: clubId,
        course_key: course.key,
        title: course.title,
        leg_count: getRelayLegs(course).length,
        started_by: startedBy,
      })
      .select()
      .single();
    if (error) {
      console.error('[이어달리기] 시작 실패:', JSON.stringify(error), error);
      if (error.code === '23505') throw new Error('이미 진행 중인 이어달리기가 있어요');
      throw new Error(errText(error));
    }
    return data as RelayChallenge;
  }

  async endRelay(relayId: string, status: 'finished' | 'cancelled'): Promise<void> {
    const { error } = await supabase
      .from('relay_challenges')
      .update({ status, finished_at: new Date().toISOString() })
      .eq('id', relayId);
    if (error) {
      console.error('[이어달리기] 종료 실패:', JSON.stringify(error), error);
      throw new Error(errText(error));
    }
  }

  async completeLeg(relayId: string, legNo: number, workoutId: string | null, note: string): Promise<void> {
    const { error } = await supabase.rpc('relay_complete_leg', {
      p_relay_id: relayId,
      p_leg_no: legNo,
      p_workout_id: workoutId,
      p_note: note || null,
    });
    if (error) {
      console.error('[이어달리기] 구간 인증 실패:', JSON.stringify(error), error);
      throw new Error(errText(error));
    }
    console.log('[이어달리기] 구간 인증 성공:', { relayId, legNo, workoutId });
  }

  async cancelLastLeg(relayId: string): Promise<void> {
    const { error } = await supabase.rpc('relay_cancel_last_leg', { p_relay_id: relayId });
    if (error) {
      console.error('[이어달리기] 구간 취소 실패:', JSON.stringify(error), error);
      throw new Error(errText(error));
    }
  }

  /** 인증에 연결할 내 최근 달리기 기록 (최근 30일, 이미 연결한 건 제외) */
  async getMyRecentRuns(userId: string, excludeIds: string[]): Promise<MyRunCandidate[]> {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('workouts')
      .select('id, value, unit, sub_type, workout_time')
      .eq('user_id', userId)
      .eq('category', '달리기')
      .gte('workout_time', since)
      .order('workout_time', { ascending: false })
      .limit(30);
    if (error) {
      console.error('[이어달리기] 내 달리기 기록 조회 실패:', JSON.stringify(error), error);
      throw new Error(errText(error));
    }
    const ex = new Set(excludeIds);
    return ((data || []) as MyRunCandidate[]).filter((w) => !ex.has(w.id));
  }
}

export default new RelayService();
