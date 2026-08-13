import { supabase } from '../lib/supabase';

// workout_source_links 는 원래 앱(iOS/Android) 동기화 중복판정 전용 장부였다.
// "개인 기록 병합신청" 디버그 도구를 위해 읽기 전용으로 웹에도 노출한다.
// (docs/plans, cardio-comms thread 82 / and #90)
export interface SourceLink {
  id: string;
  platform: 'ios' | 'android';
  source_name: string | null;
  quality_score: number;
  linked_at: string;
  raw_fields: Record<string, unknown> | null;
}

export interface MergeCandidate {
  workoutId: string;
  category: string;
  subType: string | null;
  value: number;
  unit: string;
  workoutTime: string;
  sources: SourceLink[];
}

interface LinkRow {
  id: string;
  platform: 'ios' | 'android';
  source_name: string | null;
  quality_score: number;
  linked_at: string;
  raw_fields: Record<string, unknown> | null;
  workout_id: string;
  workouts: {
    id: string;
    category: string;
    sub_type: string | null;
    value: number;
    unit: string;
    workout_time: string;
  } | null;
}

class WorkoutSourceLinkService {
  // 소스가 2개 이상 링크된(= 병합 신청 대상이 될 수 있는) 본인 활동 목록
  async getMergeCandidates(userId: string): Promise<MergeCandidate[]> {
    const { data, error } = await supabase
      .from('workout_source_links')
      .select(
        'id, platform, source_name, quality_score, linked_at, raw_fields, workout_id, workouts(id, category, sub_type, value, unit, workout_time)'
      )
      .eq('user_id', userId)
      .is('unlinked_at', null)
      .not('workout_id', 'is', null)
      .order('linked_at', { ascending: false });

    if (error) {
      console.error('[병합신청] 소스 링크 조회 실패 상세:', JSON.stringify(error), error);
      const msg = error.message || error.details || error.hint || JSON.stringify(error);
      throw new Error(`소스 링크 조회 실패: ${msg}`);
    }

    const rows = (data ?? []) as unknown as LinkRow[];
    const byWorkout = new Map<string, MergeCandidate>();

    for (const row of rows) {
      if (!row.workouts) continue; // 웹에서 이미 삭제된 workout — RLS 상 안 보여야 정상이지만 방어적으로 스킵
      const existing = byWorkout.get(row.workout_id);
      const link: SourceLink = {
        id: row.id,
        platform: row.platform,
        source_name: row.source_name,
        quality_score: row.quality_score,
        linked_at: row.linked_at,
        raw_fields: row.raw_fields,
      };
      if (existing) {
        existing.sources.push(link);
      } else {
        byWorkout.set(row.workout_id, {
          workoutId: row.workout_id,
          category: row.workouts.category,
          subType: row.workouts.sub_type,
          value: row.workouts.value,
          unit: row.workouts.unit,
          workoutTime: row.workouts.workout_time,
          sources: [link],
        });
      }
    }

    return Array.from(byWorkout.values()).filter((c) => c.sources.length > 1);
  }
}

export default new WorkoutSourceLinkService();
