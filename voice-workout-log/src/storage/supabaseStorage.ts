import type { WorkoutLog, Workout, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { calculateAllMetrics } from '../utils/calculateMetrics';

export const formatDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get current user ID from localStorage
const getCurrentUserId = (): string => {
  const userStr = localStorage.getItem('current_user');
  if (!userStr) throw new Error('로그인이 필요합니다.');
  const user = JSON.parse(userStr);
  return user.id;
};

export const getAllLogs = async (): Promise<WorkoutLog[]> => {
  try {
    const userId = getCurrentUserId();

    // Get workout logs with workouts
    const { data: logs, error: logsError } = await supabase
      .from('workout_logs')
      .select(`
        id,
        date,
        raw_text,
        normalized_text,
        memo,
        is_private,
        created_at,
        workouts (
          id,
          name,
          category,
          type,
          target,
          sets,
          reps,
          weight_kg,
          duration_min,
          distance_km,
          pace,
          speed_kph,
          incline_percent,
          resistance_level,
          adjusted_dist_km,
          volume_kg,
          run_count,
          note
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    return (logs || []).map((log: any) => ({
      id: log.id,
      date: log.date,
      rawText: log.raw_text,
      normalizedText: log.normalized_text || '',
      workouts: (log.workouts || []).map((w: any) => ({
        name: w.name,
        category: w.category || 'gym',
        type: w.type,
        target: w.target,
        sets: w.sets,
        reps: w.reps,
        weight_kg: w.weight_kg,
        duration_min: w.duration_min,
        distance_km: w.distance_km,
        pace: w.pace,
        speed_kph: w.speed_kph,
        incline_percent: w.incline_percent,
        resistance_level: w.resistance_level,
        adjusted_dist_km: w.adjusted_dist_km,
        volume_kg: w.volume_kg,
        run_count: w.run_count,
        note: w.note,
      })),
      memo: log.memo,
      createdAt: new Date(log.created_at).getTime(),
      isPrivate: log.is_private ?? false,
    }));
  } catch (error) {
    console.error('Failed to load logs:', error);
    return [];
  }
};

export const saveLog = async (log: Omit<WorkoutLog, 'id'> & { id?: string }): Promise<WorkoutLog | null> => {
  try {
    const userId = getCurrentUserId();

    // Insert workout log
    const { data: logData, error: logError } = await supabase
      .from('workout_logs')
      .insert({
        user_id: userId,
        date: log.date,
        raw_text: log.rawText,
        normalized_text: log.normalizedText,
        memo: log.memo,
        is_private: log.isPrivate ?? false, // 기본값은 공개 (false)
      })
      .select()
      .single();

    if (logError) throw logError;
    if (!logData) throw new Error('Failed to create workout log');

    // Insert workouts
    if (log.workouts && log.workouts.length > 0) {
      const workoutsToInsert = log.workouts.map((workout: Workout) => {
        // Type별 전용 지표 계산
        const metrics = calculateAllMetrics(workout);

        return {
          workout_log_id: logData.id,
          name: workout.name,
          category: workout.category || 'gym', // 기본값: gym
          type: workout.type,
          target: workout.target || 'none', // 기본값: none
          sets: workout.sets,
          reps: workout.reps,
          weight_kg: workout.weight_kg,
          duration_min: workout.duration_min,
          distance_km: workout.distance_km,
          pace: workout.pace,
          speed_kph: workout.speed_kph,
          incline_percent: workout.incline_percent,
          resistance_level: workout.resistance_level,
          adjusted_dist_km: metrics.adjusted_dist_km,
          volume_kg: metrics.volume_kg,
          run_count: metrics.run_count,
          note: workout.note,
        };
      });

      const { error: workoutsError } = await supabase
        .from('workouts')
        .insert(workoutsToInsert);

      if (workoutsError) throw workoutsError;
    }

    // Return saved log
    return {
      id: logData.id,
      date: log.date,
      rawText: log.rawText,
      normalizedText: log.normalizedText,
      workouts: log.workouts,
      memo: log.memo,
      createdAt: log.createdAt,
      isPrivate: log.isPrivate ?? false,
    };
  } catch (error) {
    console.error('Failed to save log:', error);
    throw new Error('저장에 실패했습니다.');
  }
};

export const deleteLog = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('workout_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete log:', error);
    throw new Error('삭제에 실패했습니다.');
  }
};

export const getLogById = async (id: string): Promise<WorkoutLog | null> => {
  try {
    const { data, error } = await supabase
      .from('workout_logs')
      .select(`
        id,
        date,
        raw_text,
        normalized_text,
        memo,
        is_private,
        created_at,
        workouts (
          id,
          name,
          category,
          type,
          sets,
          reps,
          weight_kg,
          duration_min,
          note
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      date: data.date,
      rawText: data.raw_text,
      normalizedText: data.normalized_text || '',
      workouts: (data.workouts || []).map((w: any) => ({
        name: w.name,
        category: w.category || 'gym',
        type: w.type,
        sets: w.sets,
        reps: w.reps,
        weight_kg: w.weight_kg,
        duration_min: w.duration_min,
        distance_km: null,
        pace: null,
        note: w.note,
      })),
      memo: data.memo,
      createdAt: new Date(data.created_at).getTime(),
      isPrivate: data.is_private ?? false,
    };
  } catch (error) {
    console.error('Failed to get log:', error);
    return null;
  }
};

export const generateId = (): string => {
  // Supabase에서 UUID를 자동 생성하므로 이 함수는 더 이상 필요 없지만,
  // 호환성을 위해 유지 (실제로는 사용되지 않음)
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// User Profile Management
export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const userId = getCurrentUserId();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      goals: data.goals,
      rawInput: data.raw_input || undefined,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  } catch (error) {
    console.error('Failed to load profile:', error);
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const userId = getCurrentUserId();

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Update existing profile
      const { error } = await supabase
        .from('user_profiles')
        .update({
          goals: profile.goals,
          raw_input: profile.rawInput || null,
        })
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      // Insert new profile
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          goals: profile.goals,
          raw_input: profile.rawInput || null,
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Failed to save profile:', error);
    throw new Error('프로필 저장에 실패했습니다.');
  }
};

export const deleteUserProfile = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();

    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to delete profile:', error);
    throw new Error('프로필 삭제에 실패했습니다.');
  }
};
