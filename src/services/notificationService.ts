import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  workout_id: string;
  club_id: string;
  type: 'like' | 'comment';
  comment_text?: string;
  comment_id?: string;
  read: boolean;
  created_at: string;
  actor?: {
    display_name: string;
    profile_image?: string;
  };
  actor_club_nickname?: string;
  club_name?: string;
  workout?: {
    category: string;
    sub_type?: string;
    value: number;
    unit: string;
    created_at: string;
  };
}

class NotificationService {
  // 내 알림 목록 조회 (읽지 않은 알림만, 최신순)
  async getMyNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    console.log('📡 Supabase 알림 조회 시작, userId:', userId);
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:users!actor_id(display_name, profile_image),
        workout:workouts!workout_id(category, sub_type, value, unit, created_at),
        club:clubs!club_id(name)
      `)
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ 알림 조회 실패:', error);
      throw error;
    }

    if (!notifications || notifications.length === 0) {
      console.log('✅ Supabase 알림 조회 성공, 데이터: 없음');
      return [];
    }

    // 클럽 닉네임 조회
    const actorIds = [...new Set(notifications.map((n: any) => n.actor_id))];
    const clubIds = [...new Set(notifications.map((n: any) => n.club_id))];

    const { data: clubMembers } = await supabase
      .from('club_members')
      .select('user_id, club_id, club_nickname')
      .in('user_id', actorIds)
      .in('club_id', clubIds);

    // 클럽 닉네임 매핑
    const nicknameMap = new Map(
      clubMembers?.map((m) => [`${m.user_id}_${m.club_id}`, m.club_nickname]) || []
    );

    // 알림 데이터에 클럽 닉네임 추가
    const result = notifications.map((n: any) => ({
      ...n,
      actor_club_nickname: nicknameMap.get(`${n.actor_id}_${n.club_id}`),
      club_name: n.club?.name,
    }));

    console.log('✅ Supabase 알림 조회 성공, 데이터:', result);
    return result as Notification[];
  }

  // 읽지 않은 알림 개수 조회
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('읽지 않은 알림 개수 조회 실패:', error);
      return 0;
    }

    return count || 0;
  }

  // 알림 읽음 처리
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('알림 읽음 처리 실패:', error);
      throw error;
    }
  }

  // 모든 알림 읽음 처리
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('모든 알림 읽음 처리 실패:', error);
      throw error;
    }
  }

  // 2주 지난 오래된 알림 삭제 (수동 호출용)
  async cleanupOldNotifications(): Promise<void> {
    const { error } = await supabase.rpc('delete_old_notifications');

    if (error) {
      console.error('오래된 알림 정리 실패:', error);
      throw error;
    }
  }

  // 실시간 알림 구독
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // 새 알림이 추가되면 상세 정보 조회 후 콜백 호출
          const { data } = await supabase
            .from('notifications')
            .select(`
              *,
              actor:users!actor_id(display_name, profile_image),
              workout:workouts!workout_id(category, sub_type, value, unit)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            callback(data as Notification);
          }
        }
      )
      .subscribe();

    return channel;
  }

  // 구독 해제
  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }
}

export default new NotificationService();
