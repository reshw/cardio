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

export interface GalleryResult {
  photos: GalleryPhoto[];
  /** MAX_PHOTOS에 걸려 일부만 가져온 경우 true (기간을 좁히라고 안내해야 함) */
  truncated: boolean;
}

/** PostgREST 기본 응답 상한. 이보다 크게 요청해도 잘리므로 페이지 단위로 나눠 받는다 */
const PAGE = 1000;
/** in() 필터의 URL 길이 제한 회피용 사용자 청크 크기 */
const USER_CHUNK = 100;
/** 모바일 WebView에서 이미지 카드가 수천 개 렌더되면 버티지 못하므로 상한을 둔다 */
const MAX_PHOTOS = 2000;

interface WorkoutRow {
  id: string;
  user_id: string;
  category: string;
  sub_type: string | null;
  proof_image: string | null;
  workout_time: string;
}

class PhotoGalleryService {
  /**
   * 클럽 멤버들이 올린 증빙사진(proof_image)을 닉네임과 함께 모아서 반환.
   * startDate/endDate는 타임존이 포함된 ISO 문자열이어야 한다 (예: '2026-07-17T00:00:00+09:00').
   * 타임존을 빼면 Postgres가 UTC로 해석해 KST 기준 날짜가 하루 어긋난다.
   */
  async getClubPhotos(clubId: string, startDate?: string, endDate?: string): Promise<GalleryResult> {
    const members = await clubService.getClubMembers(clubId);
    if (members.length === 0) return { photos: [], truncated: false };

    const nicknameMap = new Map(members.map((m) => [m.user_id, m.club_nickname || '이름없음']));
    const userIds = members.map((m) => m.user_id);

    const rows: WorkoutRow[] = [];
    let truncated = false;

    for (let i = 0; i < userIds.length && !truncated; i += USER_CHUNK) {
      const chunk = userIds.slice(i, i + USER_CHUNK);
      let offset = 0;

      // 한 청크에 1000장을 넘는 경우가 실제로 있어(4천 장대) 페이지네이션이 필수
      for (;;) {
        let query = supabase
          .from('workouts')
          .select('id, user_id, category, sub_type, proof_image, workout_time')
          .in('user_id', chunk)
          .not('proof_image', 'is', null)
          .order('workout_time', { ascending: false })
          .range(offset, offset + PAGE - 1);
        if (startDate) query = query.gte('workout_time', startDate);
        if (endDate) query = query.lte('workout_time', endDate);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        rows.push(...data);
        if (rows.length >= MAX_PHOTOS) {
          truncated = true;
          break;
        }
        if (data.length < PAGE) break;
        offset += PAGE;
      }
    }

    const photos = rows
      .slice(0, MAX_PHOTOS)
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

    return { photos, truncated };
  }
}

export default new PhotoGalleryService();
