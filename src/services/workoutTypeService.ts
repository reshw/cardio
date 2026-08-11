import { supabase } from '../lib/supabase';

export interface WorkoutSubType {
  name: string;
  unit: string;
}

export interface WorkoutType {
  id: string;
  name: string;
  emoji: string;
  unit: 'km' | 'm' | '층' | '분' | '회' | '세트';
  sub_types: WorkoutSubType[];
  sub_type_mode: 'single' | 'mixed';
  is_core: boolean; // 기본운동 여부
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkoutTypeInput {
  name: string;
  emoji: string;
  unit: 'km' | 'm' | '층' | '분' | '회' | '세트';
  sub_types?: WorkoutSubType[];
  sub_type_mode?: 'single' | 'mixed';
  is_core?: boolean;
  display_order?: number;
}

export interface UpdateWorkoutTypeInput {
  name?: string;
  emoji?: string;
  unit?: 'km' | 'm' | '층' | '분' | '회' | '세트';
  sub_types?: WorkoutSubType[];
  sub_type_mode?: 'single' | 'mixed';
  is_core?: boolean;
  display_order?: number;
  is_active?: boolean;
}

const CACHE_KEY = 'workout_types_cache_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5분
let memCache: { data: WorkoutType[]; t: number } | null = null;

function loadFromStorage(): { data: WorkoutType[]; t: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

class WorkoutTypeService {
  // 캐시된 데이터 동기 반환 — UI 초기 렌더 즉시 사용 가능 (스피너 회피)
  getCachedActiveTypes(): WorkoutType[] | null {
    const now = Date.now();
    if (memCache && now - memCache.t < CACHE_TTL) return memCache.data;
    const stored = loadFromStorage();
    if (stored && now - stored.t < CACHE_TTL) {
      memCache = stored;
      return stored.data;
    }
    return null;
  }

  // 활성 운동 종목 조회 + 캐시 (메모리 + localStorage, 5분 TTL)
  async getActiveWorkoutTypes(): Promise<WorkoutType[]> {
    const cached = this.getCachedActiveTypes();
    if (cached) return cached;

    const { data, error } = await supabase
      .from('workout_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('운동 종목 조회 실패:', error);
      throw error;
    }

    const result = data || [];
    memCache = { data: result, t: Date.now() };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(memCache)); } catch {}
    return result;
  }

  // 어드민 쓰기 후 캐시 무효화
  private invalidateCache() {
    memCache = null;
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }

  // 모든 운동 종목 조회 (어드민용 - 비활성화 포함)
  async getAllWorkoutTypes(): Promise<WorkoutType[]> {
    const { data, error } = await supabase
      .from('workout_types')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('운동 종목 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  // 운동 종목 추가
  async createWorkoutType(input: CreateWorkoutTypeInput): Promise<WorkoutType> {
    // 마지막 display_order 조회
    const { data: lastItem } = await supabase
      .from('workout_types')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (lastItem?.display_order || 0) + 1;

    const { data, error } = await supabase
      .from('workout_types')
      .insert({
        name: input.name,
        emoji: input.emoji,
        unit: input.unit,
        sub_types: input.sub_types || [],
        sub_type_mode: input.sub_type_mode || 'single',
        is_core: input.is_core || false,
        display_order: input.display_order || nextOrder,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('운동 종목 추가 실패:', error);
      throw error;
    }

    this.invalidateCache();
    return data;
  }

  // 운동 종목 수정
  async updateWorkoutType(id: string, input: UpdateWorkoutTypeInput): Promise<WorkoutType> {
    const { data, error } = await supabase
      .from('workout_types')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('운동 종목 수정 실패:', error);
      throw error;
    }

    this.invalidateCache();
    return data;
  }

  // 운동 종목 삭제 (실제로는 비활성화)
  async deleteWorkoutType(id: string): Promise<void> {
    const { error } = await supabase
      .from('workout_types')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('운동 종목 삭제 실패:', error);
      throw error;
    }
    this.invalidateCache();
  }

  // 순서 변경
  async reorderWorkoutTypes(orderedIds: string[]): Promise<void> {
    const updates = orderedIds.map((id, index) => ({
      id,
      display_order: index + 1,
    }));

    for (const update of updates) {
      await supabase
        .from('workout_types')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
    }
    this.invalidateCache();
  }

  // 활성화/비활성화 토글
  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('workout_types')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      console.error('운동 종목 활성화 토글 실패:', error);
      throw error;
    }
    this.invalidateCache();
  }
}

const workoutTypeService = new WorkoutTypeService();
export default workoutTypeService;
