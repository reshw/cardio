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
  sub_type_ratios?: Record<string, number>; // 서브타입별 비율 (예: {"일반": 0.4, "빈야사/아쉬탕가": 0.6})
  value: number;
  unit: WorkoutUnit;
  mileage?: number; // deprecated - 클럽별로 다름, club_workout_mileage 사용
  intensity: number; // 1-10 단계, 기본값 4
  proof_image?: string;
  created_at: string; // 기록을 올린 시점 (스냅샷, 순서 결정용, 수정 불가)
  workout_time: string; // 실제 운동한 시간 (사용자 수정 가능)
}

export interface CreateWorkoutData {
  user_id: string;
  category: WorkoutCategory;
  sub_type: WorkoutSubType;
  sub_type_ratios?: Record<string, number>; // 서브타입별 비율 (예: {"일반": 0.4, "빈야사/아쉬탕가": 0.6})
  value: number;
  unit: WorkoutUnit;
  intensity?: number; // 1-10 단계, 기본값 4
  proof_image?: string;
  workout_time?: string; // 실제 운동한 시간 (사용자 입력/수정 가능)
  created_at?: string; // deprecated - use workout_time instead
}

class WorkoutService {
  // 운동 기록 추가
  async createWorkout(data: CreateWorkoutData): Promise<Workout> {
    console.log('📝 운동 기록 추가 데이터:', data);
    console.log('🔧 Supabase client 확인:', !!supabase);

    const insertData: any = {
      user_id: data.user_id,
      category: data.category,
      sub_type: data.sub_type,
      value: data.value,
      unit: data.unit,
      intensity: data.intensity ?? 4, // 기본값 4
      proof_image: data.proof_image || null,
    };

    // sub_type_ratios가 있으면 포함
    if (data.sub_type_ratios) {
      insertData.sub_type_ratios = data.sub_type_ratios;
    }

    // workout_time이 제공되면 포함 (사용자가 입력한 운동 시간)
    if (data.workout_time) {
      insertData.workout_time = data.workout_time;
    }

    // created_at은 DB에서 자동 생성 (NOW())
    // Backward compatibility: created_at이 제공되면 workout_time으로 사용
    if (data.created_at && !data.workout_time) {
      insertData.workout_time = data.created_at;
    }

    console.log('📤 Insert 데이터:', insertData);

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

    // 사용자가 속한 모든 클럽에 마일리지 스냅샷 생성
    try {
      const { data: userClubs } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', data.user_id);

      if (userClubs && userClubs.length > 0) {
        console.log(`📊 ${userClubs.length}개 클럽에 마일리지 스냅샷 생성`);

        const savePromises = userClubs.map(({ club_id }) =>
          clubService.saveWorkoutMileage(club_id, workout.id, data.user_id, {
            category: data.category,
            sub_type: data.sub_type,
            value: data.value,
            workout_time: workout.workout_time,
            sub_type_ratios: data.sub_type_ratios,
          })
        );

        await Promise.all(savePromises);
        console.log('✅ 클럽 마일리지 스냅샷 생성 완료');
      }
    } catch (error) {
      console.error('⚠️ 클럽 마일리지 스냅샷 생성 실패:', error);
      // 스냅샷 생성 실패해도 운동 기록은 유지
    }

    return workout;
  }

  // 사용자의 운동 기록 조회
  async getWorkoutsByUserId(userId: string): Promise<Workout[]> {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('workout_time', { ascending: false });

    if (error) {
      console.error('운동 기록 조회 실패:', error);
      throw error;
    }

    return data || [];
  }

  // ID로 운동 기록 조회
  async getWorkoutById(workoutId: string): Promise<Workout | null> {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .single();

    if (error) {
      console.error('운동 기록 조회 실패:', error);
      return null;
    }

    return data;
  }

  // 운동 기록 수정
  async updateWorkout(
    workoutId: string,
    data: {
      value?: number;
      workout_time?: string; // 실제 운동한 시간 (수정 가능)
      created_at?: string; // deprecated - use workout_time instead
      intensity?: number;
      proof_image?: string;
    }
  ): Promise<Workout> {
    const updateData: any = {};

    if (data.value !== undefined) {
      updateData.value = data.value;
      // 마일리지는 클럽별로 club_workout_mileage에서 관리
    }

    if (data.workout_time !== undefined) {
      updateData.workout_time = data.workout_time;
    }

    // Backward compatibility
    if (data.created_at !== undefined && !data.workout_time) {
      updateData.workout_time = data.created_at;
    }

    if (data.intensity !== undefined) {
      updateData.intensity = data.intensity;
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

    // 값이나 날짜가 변경되었으면 모든 클럽의 스냅샷 재생성
    if (data.value !== undefined || data.created_at !== undefined) {
      try {
        const { data: userClubs } = await supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', updated.user_id);

        if (userClubs && userClubs.length > 0) {
          console.log(`📊 ${userClubs.length}개 클럽의 마일리지 스냅샷 재생성`);

          const savePromises = userClubs.map(({ club_id }) =>
            clubService.saveWorkoutMileage(club_id, workoutId, updated.user_id, {
              category: updated.category,
              sub_type: updated.sub_type,
              value: updated.value,
              workout_time: updated.workout_time,
              sub_type_ratios: updated.sub_type_ratios,
            })
          );

          await Promise.all(savePromises);
          console.log('✅ 클럽 마일리지 스냅샷 재생성 완료');
        }
      } catch (error) {
        console.error('⚠️ 클럽 마일리지 스냅샷 재생성 실패:', error);
      }
    }

    return updated;
  }

  // 특정 운동 기록 삭제
  async deleteWorkout(workoutId: string): Promise<void> {
    // 먼저 모든 클럽의 마일리지 스냅샷 삭제
    try {
      const { error: snapshotError } = await supabase
        .from('club_workout_mileage')
        .delete()
        .eq('workout_id', workoutId);

      if (snapshotError) {
        console.error('⚠️ 마일리지 스냅샷 삭제 실패:', snapshotError);
      } else {
        console.log('✅ 마일리지 스냅샷 삭제 완료');
      }
    } catch (error) {
      console.error('⚠️ 마일리지 스냅샷 삭제 실패:', error);
    }

    // 운동 기록 삭제
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
