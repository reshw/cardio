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

export interface WorkoutCommentWithClub extends WorkoutComment {
  club_name: string;
  club_logo?: string;
  like_count?: number;
  is_liked_by_me?: boolean;
}

export interface LikesByClub {
  clubId: string;
  clubName: string;
  clubLogo?: string;
  count: number;
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

    // 클럽 닉네임 및 클럽 프로필 이미지 조회
    const userIds = [...new Set(comments.map((c: any) => c.user_id))];
    const { data: clubMembers } = await supabase
      .from('club_members')
      .select('user_id, club_nickname, club_profile_image')
      .eq('club_id', clubId)
      .in('user_id', userIds);

    const nicknameMap = new Map(
      clubMembers?.filter((m) => m.club_nickname).map((m) => [m.user_id, m.club_nickname]) || []
    );

    const clubProfileImageMap = new Map(
      clubMembers?.filter((m) => m.club_profile_image).map((m) => [m.user_id, m.club_profile_image]) || []
    );

    // 대댓글 계층 구조 구성
    const topLevelComments: WorkoutComment[] = [];
    const commentMap = new Map<string, WorkoutComment>();

    // 1차: 모든 댓글을 Map에 저장 (클럽 닉네임 및 클럽 프로필 이미지 우선 사용)
    comments.forEach((c: any) => {
      const clubNickname = nicknameMap.get(c.user_id);
      const clubProfileImage = clubProfileImageMap.get(c.user_id);

      // 클럽 프로필 이미지 처리
      let displayProfileImage = c.user.profile_image;
      if (clubProfileImage) {
        displayProfileImage = clubProfileImage;
      }

      const comment: WorkoutComment = {
        ...c,
        user: c.user
          ? {
              display_name: clubNickname || c.user.display_name,
              profile_image: displayProfileImage,
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

  // 모든 클럽의 댓글 통합 조회 (WorkoutDetail용)
  async getCommentsFromAllClubs(workoutId: string): Promise<WorkoutCommentWithClub[]> {
    const { data: comments, error } = await supabase
      .from('workout_comments')
      .select(`
        *,
        user:users(display_name, profile_image),
        club:clubs!club_id(name, logo_url)
      `)
      .eq('workout_id', workoutId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!comments || comments.length === 0) return [];

    // 클럽 닉네임 및 클럽 프로필 이미지 조회
    const userIds = [...new Set(comments.map((c: any) => c.user_id))];
    const clubIds = [...new Set(comments.map((c: any) => c.club_id))];

    const { data: clubMembers } = await supabase
      .from('club_members')
      .select('user_id, club_id, club_nickname, club_profile_image')
      .in('user_id', userIds)
      .in('club_id', clubIds);

    // 클럽 닉네임 매핑 (user_id + club_id 조합)
    const nicknameMap = new Map(
      clubMembers
        ?.filter((m) => m.club_nickname)
        .map((m) => [`${m.user_id}_${m.club_id}`, m.club_nickname]) || []
    );

    // 클럽 프로필 이미지 매핑 (user_id + club_id 조합)
    const clubProfileImageMap = new Map(
      clubMembers
        ?.filter((m) => m.club_profile_image)
        .map((m) => [`${m.user_id}_${m.club_id}`, m.club_profile_image]) || []
    );

    // 대댓글 계층 구조 구성
    const topLevelComments: WorkoutCommentWithClub[] = [];
    const commentMap = new Map<string, WorkoutCommentWithClub>();

    // 1차: 모든 댓글을 Map에 저장 (클럽 정보 포함)
    comments.forEach((c: any) => {
      const clubNickname = nicknameMap.get(`${c.user_id}_${c.club_id}`);
      const clubProfileImage = clubProfileImageMap.get(`${c.user_id}_${c.club_id}`);

      // 클럽 프로필 이미지 처리: default:color 형식이면 생성, 아니면 URL 그대로 사용
      let displayProfileImage = c.user.profile_image;
      if (clubProfileImage) {
        if (clubProfileImage.startsWith('default:')) {
          // default:color 형식은 프론트엔드에서 처리하기 위해 그대로 전달
          displayProfileImage = clubProfileImage;
        } else {
          // URL 형식은 그대로 사용
          displayProfileImage = clubProfileImage;
        }
      }

      const comment: WorkoutCommentWithClub = {
        ...c,
        club_name: c.club?.name || '알 수 없는 클럽',
        club_logo: c.club?.logo_url,
        user: c.user
          ? {
              display_name: clubNickname || c.user.display_name,
              profile_image: displayProfileImage,
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
          parent.replies!.push(comment as any);
        }
      } else {
        // 최상위 댓글
        topLevelComments.push(comment);
      }
    });

    return topLevelComments;
  }

  // 클럽별 좋아요 집계 조회
  async getLikesByClub(workoutId: string): Promise<LikesByClub[]> {
    const { data, error } = await supabase
      .from('workout_likes')
      .select(`
        club_id,
        club:clubs!club_id(name, logo_url)
      `)
      .eq('workout_id', workoutId);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // 클럽별로 집계
    const clubMap = new Map<string, { name: string; logo?: string; count: number }>();

    data.forEach((like: any) => {
      const clubId = like.club_id;
      const clubName = like.club?.name || '알 수 없는 클럽';
      const clubLogo = like.club?.logo_url;

      if (clubMap.has(clubId)) {
        clubMap.get(clubId)!.count += 1;
      } else {
        clubMap.set(clubId, { name: clubName, logo: clubLogo, count: 1 });
      }
    });

    // 배열로 변환 및 정렬 (좋아요 많은 순)
    const result: LikesByClub[] = Array.from(clubMap.entries())
      .map(([clubId, data]) => ({
        clubId,
        clubName: data.name,
        clubLogo: data.logo,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    return result;
  }

  // 총 좋아요 개수 조회
  async getTotalLikeCount(workoutId: string): Promise<number> {
    const { count, error } = await supabase
      .from('workout_likes')
      .select('*', { count: 'exact', head: true })
      .eq('workout_id', workoutId);

    if (error) {
      console.error('총 좋아요 개수 조회 실패:', error);
      return 0;
    }

    return count || 0;
  }

  // ==================== 댓글 좋아요 ====================

  // 댓글 좋아요 추가
  async addCommentLike(commentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, user_id: userId });

    // 중복 좋아요 무시 (UNIQUE 제약 위반)
    if (error && error.code !== '23505') throw error;
  }

  // 댓글 좋아요 취소
  async removeCommentLike(commentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // 댓글 좋아요 토글
  async toggleCommentLike(commentId: string, userId: string, isLiked: boolean): Promise<void> {
    if (isLiked) {
      await this.removeCommentLike(commentId, userId);
    } else {
      await this.addCommentLike(commentId, userId);
    }
  }

  // 댓글들의 좋아요 정보 조회 (좋아요 개수 + 내가 좋아요 했는지)
  async getCommentLikesInfo(
    commentIds: string[],
    userId?: string
  ): Promise<Map<string, { count: number; isLikedByMe: boolean }>> {
    if (commentIds.length === 0) {
      return new Map();
    }

    // 모든 댓글의 좋아요 조회
    const { data: likes, error } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds);

    if (error) {
      console.error('댓글 좋아요 조회 실패:', error);
      return new Map();
    }

    // 댓글별로 집계
    const likesMap = new Map<string, { count: number; isLikedByMe: boolean }>();

    commentIds.forEach((id) => {
      likesMap.set(id, { count: 0, isLikedByMe: false });
    });

    likes?.forEach((like) => {
      const info = likesMap.get(like.comment_id)!;
      info.count += 1;
      if (userId && like.user_id === userId) {
        info.isLikedByMe = true;
      }
    });

    return likesMap;
  }

  // 모든 클럽의 댓글 통합 조회 (좋아요 정보 포함)
  async getCommentsFromAllClubsWithLikes(
    workoutId: string,
    userId?: string
  ): Promise<WorkoutCommentWithClub[]> {
    // 기존 댓글 조회
    const comments = await this.getCommentsFromAllClubs(workoutId);

    if (comments.length === 0) {
      return comments;
    }

    // 모든 댓글 ID 수집 (대댓글 포함)
    const allCommentIds: string[] = [];
    const collectIds = (commentList: WorkoutCommentWithClub[]) => {
      commentList.forEach((c) => {
        allCommentIds.push(c.id);
        if (c.replies && c.replies.length > 0) {
          collectIds(c.replies as WorkoutCommentWithClub[]);
        }
      });
    };
    collectIds(comments);

    // 좋아요 정보 조회
    const likesInfo = await this.getCommentLikesInfo(allCommentIds, userId);

    // 댓글에 좋아요 정보 추가
    const addLikesInfo = (commentList: WorkoutCommentWithClub[]) => {
      commentList.forEach((c) => {
        const info = likesInfo.get(c.id);
        c.like_count = info?.count || 0;
        c.is_liked_by_me = info?.isLikedByMe || false;

        if (c.replies && c.replies.length > 0) {
          addLikesInfo(c.replies as WorkoutCommentWithClub[]);
        }
      });
    };
    addLikesInfo(comments);

    return comments;
  }
}

export default new FeedService();
