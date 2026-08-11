import { supabase } from '../lib/supabase';

// 수기 기록 입력 허용 기간 (당일 포함 일수). null = 제한 없음
export const DEFAULT_ENTRY_LIMIT_DAYS = 3;

const ENTRY_LIMIT_KEY = 'workout_entry_limit';

interface EntryLimitValue {
  days: number | null;
}

export async function getWorkoutEntryLimitDays(): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', ENTRY_LIMIT_KEY)
      .single();

    if (error || !data?.value) return DEFAULT_ENTRY_LIMIT_DAYS;

    const days = (data.value as EntryLimitValue).days;
    if (days === null) return null;
    if (Number.isFinite(days) && days >= 1) return Math.floor(days);
    return DEFAULT_ENTRY_LIMIT_DAYS;
  } catch {
    return DEFAULT_ENTRY_LIMIT_DAYS;
  }
}

export async function setWorkoutEntryLimitDays(days: number | null, updatedBy: string): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: ENTRY_LIMIT_KEY,
      value: { days } satisfies EntryLimitValue,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });

  if (error) throw error;
}
