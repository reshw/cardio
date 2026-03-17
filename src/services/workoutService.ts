import { supabase } from '../lib/supabase';
import clubService from './clubService';

// 주 카테고리
export type WorkoutCategory = '달리기' | '사이클' | '수영' | '계단' | '복싱' | '요가';

// 세부 카테고리
export type RunningSubType = '트레드밀' | '러닝';
export type CycleSubType = '실외' | '실내';
export type BoxingSubType = '샌드백/미트' | '스파링';
export type YogaSubType = '일반' | '빈야사/아쉬탕가';

export type WorkoutSubType = RunningSubType | CycleSubType | BoxingSubType | YogaSubType | null;

// 단위
export type WorkoutUnit = 'km' | 'm' | '층' | '분';

export interface Workout {
  id: string;
  user_id: string;
  category: WorkoutCategory;
  sub_type: WorkoutSubType;
  value: number;
  unit: WorkoutUnit;
  mileage: number;
  intensity: number; // 1-10 단계, 기본값 4
  proof_image?: string;
  created_at: string;
}

export interface CreateWorkoutData {
  user_id: string;
  category: WorkoutCategory;
  sub_type: WorkoutSubType;
  value: number;
  unit: WorkoutUnit;
  intensity?: number; // 1-10 단계, 기본값 4
  proof_image?: string;
  created_at?: string;
}

class WorkoutService {
  // 운동 기록 추가
  async createWorkout(data: CreateWorkoutData): Promise<Workout> {
    console.log('📝 운동 기록 추가 데이터:', data);
    console.log('🔧 Supabase client 확인:', !!supabase);

    // 마일리지 계산
    const mileage = clubService.calculateMileage(data.category, data.sub_type, data.value);

    const insertData: any = {
      user_id: data.user_id,
      category: data.category,
      sub_type: data.sub_type,
      value: data.value,
      unit: data.unit,
      mileage: mileage,
      intensity: data.intensity ?? 4, // 기본값 4
      proof_image: data.proof_image || null,
    };

    // created_at이 제공되면 포함
    if (data.created_at) {
      insertData.created_at = data.created_at;
    }

    console.log('📤 Insert 데이터 (마일리지 포함):', insertData);

    const { data: workout, error } = await supabase
      .from('workouts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ 운동 기록 추가 실패:', error);
      console.error('에러 상세:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('✅ 운동 기록 추가 성공:', workout);
    return workout;
  }

  // 사용자의 운동 기록 조회
  async getWorkoutsByUserId(userId: string): Promise<Workout[]> {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('운동 기록 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  // 운동 기록 수정
  async updateWorkout(
    workoutId: string,
    data: {
      value?: number;
      created_at?: string;
      proof_image?: string;
    }
  ): Promise<Workout> {
    const updateData: any = {};

    if (data.value !== undefined) {
      updateData.value = data.value;
      // 값이 변경되면 마일리지도 재계산해야 함
      // 하지만 category, sub_type이 필요하므로 먼저 조회
      const { data: workout } = await supabase
        .from('workouts')
        .select('category, sub_type')
        .eq('id', workoutId)
        .single();

      if (workout) {
        updateData.mileage = clubService.calculateMileage(
          workout.category,
          workout.sub_type,
          data.value
        );
      }
    }

    if (data.created_at !== undefined) {
      updateData.created_at = data.created_at;
    }

    if (data.proof_image !== undefined) {
      updateData.proof_image = data.proof_image;
    }

    const { data: updated, error } = await supabase
      .from('workouts')
      .update(updateData)
      .eq('id', workoutId)
      .select()
      .single();

    if (error) {
      console.error('운동 기록 수정 실패:', error);
      throw error;
    }

    return updated;
  }

  // 특정 운동 기록 삭제
  async deleteWorkout(workoutId: string): Promise<void> {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId);

    if (error) {
      console.error('운동 기록 삭제 실패:', error);
      throw error;
    }
  }
}

export default new WorkoutService();
