import { supabase } from '../lib/supabase';

export type RaceCategory = '5K' | '10K' | '하프' | '풀' | '기타';

export interface RaceRecord {
  id: string;
  user_id: string;
  race_name: string;
  race_date: string;
  category: RaceCategory;
  finish_time: string;
  image_url?: string;
  link_url?: string;
  notes?: string;
  created_at: string;
}

export interface CreateRaceData {
  user_id: string;
  race_name: string;
  race_date: string;
  category: RaceCategory;
  finish_time: string;
  image_url?: string;
  link_url?: string;
  notes?: string;
}

export function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Infinity;
}

export function computePBIds(records: RaceRecord[]): Set<string> {
  const pbIds = new Set<string>();
  const cats: RaceCategory[] = ['5K', '10K', '하프', '풀'];
  for (const cat of cats) {
    const catRecords = records.filter(r => r.category === cat && r.finish_time);
    if (catRecords.length === 0) continue;
    const best = catRecords.reduce((a, b) =>
      parseTimeToSeconds(a.finish_time) <= parseTimeToSeconds(b.finish_time) ? a : b
    );
    pbIds.add(best.id);
  }
  return pbIds;
}

class RaceService {
  async getRecordsByUserId(userId: string): Promise<RaceRecord[]> {
    const { data, error } = await supabase
      .from('race_records')
      .select('*')
      .eq('user_id', userId)
      .order('race_date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createRecord(data: CreateRaceData): Promise<RaceRecord> {
    const session = await supabase.auth.getSession();
    const sessionUserId = session.data.session?.user?.id ?? 'NULL';
    const dataUserId = data.user_id;
    const match = sessionUserId === dataUserId;
    console.log('[raceService] session user_id:', sessionUserId);
    console.log('[raceService] insert user_id:', dataUserId);
    console.log('[raceService] IDs match:', match);
    console.log('[raceService] insert data:', data);
    const { data: record, error } = await supabase
      .from('race_records')
      .insert(data)
      .select()
      .single();
    if (error) {
      console.error('[raceService] createRecord error:', error);
      throw error;
    }
    return record;
  }

  async updateRecord(id: string, data: Partial<CreateRaceData>): Promise<RaceRecord> {
    const { data: record, error } = await supabase
      .from('race_records')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return record;
  }

  async deleteRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('race_records')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}

export default new RaceService();
