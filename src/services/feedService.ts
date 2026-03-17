import { supabase } from '../lib/supabase';
import type { Workout } from './workoutService';

export interface WorkoutLike {
  id: string;
  workout_id: string;
  club_id: string;
  user_id: string;
  created_at: string;
}

export interface WorkoutComment {
  id: string;
  workout_id: string;
  club_id: string;
  user_id: string;
  parent_id: string | null;
  comment: string;
  created_at: string;
  user?: {
    display_name: string;
    profile_image?: string;
  };
  replies?: WorkoutComment[];
}

export interface WorkoutFeedItem {
  workout: Workout;
  user_display_name: string;
  user_profile_image?: string;
  club_nickname?: string;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
}

class FeedService {
  // 좋아요 추가
  async addLike(workoutId: string, clubId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('workout_likes')
      .insert({ workout_id: workoutId, club_id: clubId, user_id: userId });

    // 중복 좋아요 무시 (UNIQUE 제약 위반)
    if (error && error.code !== '23505') throw error;
  }

  // 좋아요 취소
  async removeLike(workoutId: string, clubId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('workout_likes')
      .delete()
      .eq('workout_id', workoutId)
      .eq('club_id', clubId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // 좋아요 토글 (편의 메서드)
  async toggleLike(workoutId: string, clubId: string, userId: string, isLiked: boolean): Promise<void> {
    if (isLiked) {
      await this.removeLike(workoutId, clubId, userId);
    } else {
      await this.addLike(workoutId, clubId, userId);
    }
  }

  // 댓글 추가
  async addComment(
    workoutId: string,
    clubId: string,
    userId: string,
    comment: string,
    parentId?: string
  ): Promise<WorkoutComment> {
    const { data, error } = await supabase
      .from('workout_comments')
      .insert({
        workout_id: workoutId,
        club_id: clubId,
        user_id: userId,
        comment: comment.trim(),
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // 댓글 삭제 (본인만)
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('workout_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // 특정 운동의 댓글 조회 (대댓글 계층 구조 포함)
  async getComments(workoutId: string, clubId: string): Promise<WorkoutComment[]> {
    const { data: comments, error } = await supabase
      .from('workout_comments')
      .select(`
        *,
        user:users(display_name, profile_image)
      `)
      .eq('workout_id', workoutId)
      .eq('club_id', clubId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!comments || comments.length === 0) return [];

    // 클럽 닉네임 조회
    const userIds = [...new Set(comments.map((c: any) => c.user_id))];
    const { data: clubMembers } = await supabase
      .from('club_members')
      .select('user_id, club_nickname')
      .eq('club_id', clubId)
      .in('user_id', userIds);

    const nicknameMap = new Map(
      clubMembers?.filter((m) => m.club_nickname).map((m) => [m.user_id, m.club_nickname]) || []
    );

    // 대댓글 계층 구조 구성
    const topLevelComments: WorkoutComment[] = [];
    const commentMap = new Map<string, WorkoutComment>();

    // 1차: 모든 댓글을 Map에 저장 (클럽 닉네임 우선 사용)
    comments.forEach((c: any) => {
      const clubNickname = nicknameMap.get(c.user_id);
      const comment: WorkoutComment = {
        ...c,
        user: c.user
          ? {
              display_name: clubNickname || c.user.display_name,
              profile_image: c.user.profile_image,
            }
          : undefined,
        replies: [],
      };
      commentMap.set(c.id, comment);
    });

    // 2차: 계층 구조 구성
    comments.forEach((c: any) => {
      const comment = commentMap.get(c.id)!;
      if (c.parent_id) {
        // 대댓글: 부모에 추가
        const parent = commentMap.get(c.parent_id);
        if (parent) {
          parent.replies!.push(comment);
        }
      } else {
        // 최상위 댓글
        topLevelComments.push(comment);
      }
    });

    return topLevelComments;
  }
}

export default new FeedService();
