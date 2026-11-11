import { supabase } from '../lib/supabase';

// 카디오 랩드 — 회원 한 명의 연간 결산.
// 새 테이블/RPC 없이 기존 데이터만으로 계산한다:
//   - club_workout_mileage (+ workouts 임베드): 내 올해/작년 기록
//   - get_club_mileage_summary_range: 클럽 전체 회원별 합계 → 순위·기여도
//   - workout_likes: 받은/보낸 응원

export interface WrappedSport {
  category: string;
  unit: string;
  value: number;
  count: number;
  mileage: number;
}

export interface WrappedWorkout {
  date: string; // YYYY-MM-DD
  category: string;
  subType: string | null;
  value: number;
  unit: string;
  mileage: number;
}

export interface WrappedData {
  year: number;
  asOf: string; // 집계 기준일 YYYY-MM-DD
  nickname: string;
  clubName: string;
  totalMileage: number;
  workoutCount: number;
  activeDays: number;
  elapsedDays: number; // 1/1 ~ 기준일 일수
  first: WrappedWorkout | null;
  best: WrappedWorkout | null;
  sports: WrappedSport[]; // 마일리지 순
  distanceKm: number; // 달리기+자전거+등산 km + 수영 m/1000
  fullMarathons: WrappedWorkout[];
  streak: { days: number; start: string; end: string } | null;
  monthly: number[]; // 12개, 마일리지
  weekday: number[]; // 7개 (일~토), 운동한 날 수
  likesReceived: number;
  likesGiven: number;
  prevYear: { mileage: number; days: number } | null;
  rank: number | null;
  memberCount: number;
  clubTotalMileage: number;
}

const DISTANCE_KM_CATEGORIES = new Set(['달리기', '사이클', '등산']);

const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// 'YYYY-MM-DD' 를 UTC 자정으로 — 요일·일수 계산이 시간대에 흔들리지 않게
const dayNum = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 864e5;

interface MileageRow {
  workout_id: string;
  mileage: number | null;
  workout_date: string;
  workout: { category: string; sub_type: string | null; value: number | null; unit: string | null } | null;
}

async function fetchRows(clubId: string, userId: string, year: number): Promise<MileageRow[]> {
  const { data, error } = await supabase
    .from('club_workout_mileage')
    .select('workout_id, mileage, workout_date, workout:workouts(category, sub_type, value, unit)')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('year', year)
    .order('workout_date', { ascending: true })
    .range(0, 4999);
  if (error) {
    console.error(`[카디오랩드] ${year} 기록 조회 실패:`, JSON.stringify(error), error);
    throw error;
  }
  return (data || []) as unknown as MileageRow[];
}

function toWorkout(r: MileageRow): WrappedWorkout {
  return {
    date: r.workout_date,
    category: r.workout?.category ?? '기타',
    subType: r.workout?.sub_type ?? null,
    value: Number(r.workout?.value ?? 0),
    unit: r.workout?.unit ?? '',
    mileage: Number(r.mileage ?? 0),
  };
}

function longestStreak(dates: string[]): WrappedData['streak'] {
  if (dates.length === 0) return null;
  const nums = dates.map(dayNum);
  let best = { len: 1, s: 0, e: 0 };
  let s = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) s = i;
    if (i - s + 1 > best.len) best = { len: i - s + 1, s, e: i };
  }
  return { days: best.len, start: dates[best.s], end: dates[best.e] };
}

async function countLikes(clubId: string, userId: string, year: number) {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const [received, given] = await Promise.all([
    supabase
      .from('workout_likes')
      .select('id, workouts!inner(user_id)', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('workouts.user_id', userId)
      .neq('user_id', userId)
      .gte('created_at', from)
      .lt('created_at', to),
    supabase
      .from('workout_likes')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .gte('created_at', from)
      .lt('created_at', to),
  ]);
  // 좋아요는 부가 카드라 실패해도 랩드 전체를 막지 않는다 (원인은 로그로 남김)
  if (received.error) console.error('[카디오랩드] 받은 좋아요 조회 실패:', JSON.stringify(received.error), received.error);
  if (given.error) console.error('[카디오랩드] 보낸 좋아요 조회 실패:', JSON.stringify(given.error), given.error);
  return { received: received.count ?? 0, given: given.count ?? 0 };
}

class WrappedService {
  async getWrapped(clubId: string, clubName: string, userId: string, fallbackName: string, year: number): Promise<WrappedData> {
    const today = new Date();
    const asOf = today.getFullYear() > year ? `${year}-12-31` : toYmd(today);

    const [rows, prevRows, summaryRes, likes, memberRes] = await Promise.all([
      fetchRows(clubId, userId, year),
      fetchRows(clubId, userId, year - 1),
      supabase.rpc('get_club_mileage_summary_range', {
        p_club_id: clubId,
        p_start_date: `${year}-01-01`,
        p_end_date: `${year}-12-31`,
      }),
      countLikes(clubId, userId, year),
      supabase.from('club_members').select('club_nickname').eq('club_id', clubId).eq('user_id', userId).maybeSingle(),
    ]);

    if (summaryRes.error) {
      console.error('[카디오랩드] 클럽 합계 조회 실패:', JSON.stringify(summaryRes.error), summaryRes.error);
      throw summaryRes.error;
    }

    const workouts = rows.map(toWorkout);
    const counted = workouts.filter((w) => w.mileage > 0);

    // 날짜
    const dates = [...new Set(counted.map((w) => w.date))].sort();
    const monthly = Array(12).fill(0);
    counted.forEach((w) => { monthly[+w.date.slice(5, 7) - 1] += w.mileage; });
    const weekday = Array(7).fill(0);
    dates.forEach((d) => { weekday[(dayNum(d) + 4) % 7] += 1; }); // 1970-01-01 = 목요일

    // 종목
    const sportMap = new Map<string, WrappedSport>();
    counted.forEach((w) => {
      const key = `${w.category}|${w.unit}`;
      const s = sportMap.get(key) ?? { category: w.category, unit: w.unit, value: 0, count: 0, mileage: 0 };
      s.value += w.value;
      s.count += 1;
      s.mileage += w.mileage;
      sportMap.set(key, s);
    });
    const sports = [...sportMap.values()].sort((a, b) => b.mileage - a.mileage);

    const distanceKm = counted.reduce((sum, w) => {
      if (DISTANCE_KM_CATEGORIES.has(w.category) && w.unit === 'km') return sum + w.value;
      if (w.category === '수영' && w.unit === 'm') return sum + w.value / 1000;
      return sum;
    }, 0);

    const best = counted.reduce<WrappedWorkout | null>((b, w) => (!b || w.mileage > b.mileage ? w : b), null);
    const fullMarathons = counted.filter((w) => w.category === '달리기' && w.unit === 'km' && w.value >= 42);

    // 작년: DB 기록이 반년 이상 있을 때만 비교 (앱 도입 전 기록이 비어 있는 회원 보호)
    const prevCounted = prevRows.filter((r) => Number(r.mileage ?? 0) > 0);
    const prevMonths = new Set(prevCounted.map((r) => r.workout_date.slice(0, 7)));
    const prevYear = prevMonths.size >= 6
      ? {
          mileage: prevCounted.reduce((s, r) => s + Number(r.mileage ?? 0), 0),
          days: new Set(prevCounted.map((r) => r.workout_date)).size,
        }
      : null;

    // 클럽 순위
    const totals = ((summaryRes.data || []) as { user_id: string; total_mileage: number }[])
      .map((r) => ({ id: r.user_id, total: Number(r.total_mileage ?? 0) }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
    const myIdx = totals.findIndex((r) => r.id === userId);
    const clubTotalMileage = totals.reduce((s, r) => s + r.total, 0);

    const totalMileage = counted.reduce((s, w) => s + w.mileage, 0);
    const result: WrappedData = {
      year,
      asOf,
      nickname: memberRes.data?.club_nickname || fallbackName,
      clubName,
      totalMileage,
      workoutCount: counted.length,
      activeDays: dates.length,
      elapsedDays: dayNum(asOf) - dayNum(`${year}-01-01`) + 1,
      first: counted[0] ?? null,
      best,
      sports,
      distanceKm,
      fullMarathons,
      streak: longestStreak(dates),
      monthly,
      weekday,
      likesReceived: likes.received,
      likesGiven: likes.given,
      prevYear,
      rank: myIdx >= 0 ? myIdx + 1 : null,
      memberCount: totals.length,
      clubTotalMileage,
    };
    console.log('[카디오랩드] 계산 완료:', { workouts: result.workoutCount, days: result.activeDays, rank: result.rank });
    return result;
  }
}

export default new WrappedService();
