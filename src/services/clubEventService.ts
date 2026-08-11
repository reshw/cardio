import { supabase } from '../lib/supabase';
import clubService from './clubService';

export type ClubEventType = 'trail' | 'lsd' | 'interval' | 'swim' | 'gathering' | 'race' | 'etc';
export type CheckinStatus = 'pending' | 'approved' | 'rejected';

export const EVENT_TYPE_LABELS: Record<ClubEventType, string> = {
  trail: '트레일런',
  lsd: 'LSD',
  interval: '인터벌',
  swim: '수영',
  gathering: '정모',
  race: '대회',
  etc: '기타',
};

export const EVENT_TYPE_ICONS: Record<ClubEventType, string> = {
  trail: '🥾',
  lsd: '🏃',
  interval: '⏱️',
  swim: '🏊',
  gathering: '🤝',
  race: '🏅',
  etc: '📌',
};

export interface EventPhoto {
  id: string;
  event_id: string;
  user_id: string;
  photo_url: string;
  created_at: string;
  nickname: string;
  profile_image?: string;
}

export interface EventCheckin {
  id: string;
  event_id: string;
  user_id: string;
  status: CheckinStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  nickname: string;
  profile_image?: string;
  reviewer_nickname?: string;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  title: string;
  event_type: ClubEventType;
  category_text?: string; // 종목 자유입력 (예: LSD, 인터벌 러닝) — 검증/필터 없음
  starts_at: string;
  gpx_url?: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  checkins: EventCheckin[];
}

interface ClubEventRow {
  id: string;
  club_id: string;
  title: string;
  event_type: ClubEventType;
  category_text: string | null;
  starts_at: string;
  gpx_url: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CheckinRow {
  id: string;
  event_id: string;
  user_id: string;
  status: CheckinStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** club_members 를 조회해 user_id → 닉네임/프로필 맵으로 변환 (photoGalleryService 와 동일 패턴) */
async function buildNicknameMap(clubId: string): Promise<Map<string, { nickname: string; profileImage?: string }>> {
  const members = await clubService.getClubMembers(clubId);
  const map = new Map<string, { nickname: string; profileImage?: string }>();
  for (const m of members) {
    map.set(m.user_id, {
      nickname: m.club_nickname || m.user?.display_name || '회원',
      profileImage: m.club_profile_image || m.user?.profile_image,
    });
  }
  return map;
}

function attachCheckins(
  events: ClubEventRow[],
  checkins: CheckinRow[],
  nicknameMap: Map<string, { nickname: string; profileImage?: string }>
): ClubEvent[] {
  const byEvent = new Map<string, CheckinRow[]>();
  for (const c of checkins) {
    const list = byEvent.get(c.event_id) ?? [];
    list.push(c);
    byEvent.set(c.event_id, list);
  }

  return events.map((e) => ({
    ...e,
    category_text: e.category_text ?? undefined,
    gpx_url: e.gpx_url ?? undefined,
    description: e.description ?? undefined,
    checkins: (byEvent.get(e.id) ?? []).map((c) => ({
      id: c.id,
      event_id: c.event_id,
      user_id: c.user_id,
      status: c.status,
      reviewed_by: c.reviewed_by ?? undefined,
      reviewed_at: c.reviewed_at ?? undefined,
      created_at: c.created_at,
      nickname: nicknameMap.get(c.user_id)?.nickname ?? '회원',
      profile_image: nicknameMap.get(c.user_id)?.profileImage,
      reviewer_nickname: c.reviewed_by ? nicknameMap.get(c.reviewed_by)?.nickname : undefined,
    })),
  }));
}

const clubEventService = {
  /** 기간 내 행사 목록 (달력 렌더용). fromISO/toISO 생략 시 전체 */
  async listEvents(clubId: string, fromISO?: string, toISO?: string): Promise<ClubEvent[]> {
    let query = supabase
      .from('club_events')
      .select('id, club_id, title, event_type, category_text, starts_at, gpx_url, description, created_by, created_at, updated_at')
      .eq('club_id', clubId)
      .order('starts_at', { ascending: true });

    if (fromISO) query = query.gte('starts_at', fromISO);
    if (toISO) query = query.lte('starts_at', toISO);

    const { data: events, error } = await query;
    if (error) {
      console.error('[클럽달력] 행사 목록 조회 실패:', JSON.stringify(error), error);
      throw error;
    }
    if (!events || events.length === 0) return [];

    const eventIds = events.map((e) => e.id);
    const [{ data: checkins, error: checkinError }, nicknameMap] = await Promise.all([
      supabase
        .from('club_event_checkins')
        .select('id, event_id, user_id, status, reviewed_by, reviewed_at, created_at')
        .in('event_id', eventIds),
      buildNicknameMap(clubId),
    ]);

    if (checkinError) {
      console.error('[클럽달력] 체크인 목록 조회 실패:', JSON.stringify(checkinError), checkinError);
      throw checkinError;
    }

    return attachCheckins(events, checkins ?? [], nicknameMap);
  },

  /** 다가오는 행사 (오늘 이후, 가까운 순) */
  async listUpcomingEvents(clubId: string, limit = 3): Promise<ClubEvent[]> {
    const nowISO = new Date().toISOString();
    const all = await this.listEvents(clubId, nowISO);
    return all.slice(0, limit);
  },

  async getEvent(eventId: string): Promise<ClubEvent | null> {
    const { data: event, error } = await supabase
      .from('club_events')
      .select('id, club_id, title, event_type, category_text, starts_at, gpx_url, description, created_by, created_at, updated_at')
      .eq('id', eventId)
      .maybeSingle();

    if (error) {
      console.error('[클럽달력] 행사 상세 조회 실패:', JSON.stringify(error), error);
      throw error;
    }
    if (!event) return null;

    const [{ data: checkins, error: checkinError }, nicknameMap] = await Promise.all([
      supabase
        .from('club_event_checkins')
        .select('id, event_id, user_id, status, reviewed_by, reviewed_at, created_at')
        .eq('event_id', eventId),
      buildNicknameMap(event.club_id),
    ]);

    if (checkinError) {
      console.error('[클럽달력] 체크인 조회 실패:', JSON.stringify(checkinError), checkinError);
      throw checkinError;
    }

    return attachCheckins([event], checkins ?? [], nicknameMap)[0];
  },

  async createEvent(params: {
    clubId: string;
    createdBy: string;
    title: string;
    eventType: ClubEventType;
    categoryText?: string;
    startsAt: string; // ISO
    gpxUrl?: string;
    description?: string;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('club_events')
      .insert({
        club_id: params.clubId,
        created_by: params.createdBy,
        title: params.title,
        event_type: params.eventType,
        category_text: params.categoryText || null,
        starts_at: params.startsAt,
        gpx_url: params.gpxUrl || null,
        description: params.description || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[클럽달력] 행사 등록 실패:', JSON.stringify(error), error);
      throw error;
    }
    return data.id;
  },

  async updateEvent(eventId: string, params: {
    title?: string;
    eventType?: ClubEventType;
    categoryText?: string;
    startsAt?: string;
    gpxUrl?: string;
    description?: string;
  }): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (params.title !== undefined) patch.title = params.title;
    if (params.eventType !== undefined) patch.event_type = params.eventType;
    if (params.categoryText !== undefined) patch.category_text = params.categoryText || null;
    if (params.startsAt !== undefined) patch.starts_at = params.startsAt;
    if (params.gpxUrl !== undefined) patch.gpx_url = params.gpxUrl || null;
    if (params.description !== undefined) patch.description = params.description || null;

    const { error } = await supabase.from('club_events').update(patch).eq('id', eventId);
    if (error) {
      console.error('[클럽달력] 행사 수정 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase.from('club_events').delete().eq('id', eventId);
    if (error) {
      console.error('[클럽달력] 행사 삭제 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  /** 셀프체크인 (사전/사후 무관, 마감 없음) */
  async checkIn(eventId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('club_event_checkins')
      .insert({ event_id: eventId, user_id: userId });

    // 이미 체크인한 경우(unique 위반)는 조용히 무시 — 토글 UI에서 중복 클릭 방지용
    if (error && error.code === '23505') return;
    if (error) {
      console.error('[클럽달력] 체크인 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  async cancelCheckIn(eventId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('club_event_checkins')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);
    if (error) {
      console.error('[클럽달력] 체크인 취소 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  /**
   * 운영진 승인 처리. 이 행사의 체크인 전체를 대상으로, approvedUserIds 에 포함된 사람은
   * approved, 나머지는 rejected 로 갱신한다 (이전 상태 무관 — 재검토 허용).
   * 소셜포인트는 발행하지 않는다 (docs/plans/클럽달력.md 참고 — 배점 확정 후 별도 작업).
   */
  async reviewCheckins(params: {
    eventId: string;
    approvedUserIds: string[];
    adminId: string;
  }): Promise<void> {
    const { data: allCheckins, error: fetchError } = await supabase
      .from('club_event_checkins')
      .select('user_id')
      .eq('event_id', params.eventId);

    if (fetchError) {
      console.error('[클럽달력] 체크인 목록 조회 실패:', JSON.stringify(fetchError), fetchError);
      throw fetchError;
    }

    const approvedSet = new Set(params.approvedUserIds);
    const rejectUserIds = (allCheckins ?? [])
      .map((c) => c.user_id)
      .filter((uid) => !approvedSet.has(uid));

    const now = new Date().toISOString();

    if (params.approvedUserIds.length > 0) {
      const { error: approveError } = await supabase
        .from('club_event_checkins')
        .update({ status: 'approved', reviewed_by: params.adminId, reviewed_at: now })
        .eq('event_id', params.eventId)
        .in('user_id', params.approvedUserIds);

      if (approveError) {
        console.error('[클럽달력] 체크인 승인 실패:', JSON.stringify(approveError), approveError);
        throw approveError;
      }
    }

    if (rejectUserIds.length > 0) {
      const { error: rejectError } = await supabase
        .from('club_event_checkins')
        .update({ status: 'rejected', reviewed_by: params.adminId, reviewed_at: now })
        .eq('event_id', params.eventId)
        .in('user_id', rejectUserIds);

      if (rejectError) {
        console.error('[클럽달력] 체크인 반려 실패:', JSON.stringify(rejectError), rejectError);
        throw rejectError;
      }
    }
  },

  /** 승인/반려된 체크인을 다시 검토 대기 상태로 되돌림 */
  async resetCheckinStatus(checkinId: string): Promise<void> {
    const { error } = await supabase
      .from('club_event_checkins')
      .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
      .eq('id', checkinId);
    if (error) {
      console.error('[클럽달력] 체크인 상태 초기화 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  /** GPX 파일을 club-event-gpx 버킷에 올리고 공개 URL을 반환 */
  async uploadGpxFile(clubId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'gpx';
    const path = `${clubId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('club-event-gpx')
      .upload(path, file, { contentType: file.type || 'application/gpx+xml' });

    if (error) {
      console.error('[클럽달력] GPX 업로드 실패:', JSON.stringify(error), error);
      throw error;
    }
    return supabase.storage.from('club-event-gpx').getPublicUrl(path).data.publicUrl;
  },

  /** 행사 갤러리: 참가/체크인 여부 상관없이 클럽원이 올린 사진 목록 (최신순) */
  async listEventPhotos(eventId: string, clubId: string): Promise<EventPhoto[]> {
    const [{ data, error }, nicknameMap] = await Promise.all([
      supabase
        .from('club_event_photos')
        .select('id, event_id, user_id, photo_url, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      buildNicknameMap(clubId),
    ]);

    if (error) {
      console.error('[클럽달력] 행사 사진 조회 실패:', JSON.stringify(error), error);
      throw error;
    }

    return (data ?? []).map((p) => ({
      ...p,
      nickname: nicknameMap.get(p.user_id)?.nickname ?? '회원',
      profile_image: nicknameMap.get(p.user_id)?.profileImage,
    }));
  },

  /** uploadToR2로 이미 올라간 사진 URL을 행사 갤러리에 등록 */
  async addEventPhoto(eventId: string, userId: string, photoUrl: string): Promise<void> {
    const { error } = await supabase
      .from('club_event_photos')
      .insert({ event_id: eventId, user_id: userId, photo_url: photoUrl });
    if (error) {
      console.error('[클럽달력] 행사 사진 등록 실패:', JSON.stringify(error), error);
      throw error;
    }
  },

  async deleteEventPhoto(photoId: string): Promise<void> {
    const { error } = await supabase.from('club_event_photos').delete().eq('id', photoId);
    if (error) {
      console.error('[클럽달력] 행사 사진 삭제 실패:', JSON.stringify(error), error);
      throw error;
    }
  },
};

export default clubEventService;
