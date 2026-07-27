import { supabase } from '../lib/supabase';
import clubService from './clubService';

export interface GalleryPhoto {
  id: string;
  url: string;
  nickname: string;
  userId: string;
  category: string;
  subType: string | null;
  workoutTime: string;
}

class PhotoGalleryService {
  // 클럽 멤버들의 증빙사진(proof_image) 첨부 운동 기록을 모아서 반환
  async getClubPhotos(clubId: string, startDate?: string, endDate?: string): Promise<GalleryPhoto[]> {
    const members = await clubService.getClubMembers(clubId);
    if (members.length === 0) return [];

    const nicknameMap = new Map(members.map((m) => [m.user_id, m.club_nickname || '이름없음']));
    const userIds = members.map((m) => m.user_id);

    const CHUNK_SIZE = 100;
    let rows: {
      id: string;
      user_id: string;
      category: string;
      sub_type: string | null;
      proof_image: string | null;
      workout_time: string;
    }[] = [];

    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      let query = supabase
        .from('workouts')
        .select('id, user_id, category, sub_type, proof_image, workout_time')
        .in('user_id', chunk)
        .not('proof_image', 'is', null);
      if (startDate) query = query.gte('workout_time', startDate);
      if (endDate) query = query.lte('workout_time', endDate);

      const { data, error } = await query;
      if (error) throw error;
      if (data) rows = rows.concat(data);
    }

    return rows
      .map((w) => ({
        id: w.id,
        url: w.proof_image as string,
        nickname: nicknameMap.get(w.user_id) || '이름없음',
        userId: w.user_id,
        category: w.category,
        subType: w.sub_type,
        workoutTime: w.workout_time,
      }))
      .sort((a, b) => new Date(b.workoutTime).getTime() - new Date(a.workoutTime).getTime());
  }
}

export default new PhotoGalleryService();
