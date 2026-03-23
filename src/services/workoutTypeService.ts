import { supabase } from '../lib/supabase';

export interface WorkoutType {
  id: string;
  name: string;
  emoji: string;
  unit: 'km' | 'm' | '층' | '분' | '회' | '세트';
  sub_types: string[];
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
  sub_types?: string[];
  sub_type_mode?: 'single' | 'mixed';
  is_core?: boolean;
  display_order?: number;
}

export interface UpdateWorkoutTypeInput {
  name?: string;
  emoji?: string;
  unit?: 'km' | 'm' | '층' | '분' | '회' | '세트';
  sub_types?: string[];
  sub_type_mode?: 'single' | 'mixed';
  is_core?: boolean;
  display_order?: number;
  is_active?: boolean;
}

class WorkoutTypeService {
  // 모든 운동 종목 조회 (활성화된 것만)
  async getActiveWorkoutTypes(): Promise<WorkoutType[]> {
    const { data, error } = await supabase
      .from('workout_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('운동 종목 조회 실패:', error);
      throw error;
    }

    return data || [];
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
  }
}

const workoutTypeService = new WorkoutTypeService();
export default workoutTypeService;
