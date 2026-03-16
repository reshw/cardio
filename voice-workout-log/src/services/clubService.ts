import * as clubStorage from '../storage/clubStorage';
import type {
  Club,
  ClubWithMemberInfo,
  ClubDetail,
  ClubMemberWithUser,
  ClubFeedWithDetails,
} from '../types';

class ClubService {
  // ===== Club Management =====

  async createClub(data: {
    name: string;
    description?: string;
    is_public: boolean;
  }): Promise<Club> {
    // Validation: club name length
    if (data.name.trim().length < 2) {
      throw new Error('클럽명은 최소 2자 이상이어야 합니다.');
    }
    if (data.name.length > 50) {
      throw new Error('클럽명은 최대 50자까지 입력할 수 있습니다.');
    }

    return await clubStorage.createClub(data);
  }

  async getMyClubs(): Promise<ClubWithMemberInfo[]> {
    return await clubStorage.getMyClubs();
  }

  async searchPublicClubs(query?: string): Promise<Club[]> {
    return await clubStorage.searchPublicClubs(query);
  }

  async getClubDetail(clubId: string): Promise<ClubDetail> {
    return await clubStorage.getClubDetail(clubId);
  }

  async updateClub(
    clubId: string,
    updates: Partial<Pick<Club, 'name' | 'description' | 'is_public'>>
  ): Promise<void> {
    if (updates.name && updates.name.trim().length < 2) {
      throw new Error('클럽명은 최소 2자 이상이어야 합니다.');
    }
    return await clubStorage.updateClub(clubId, updates);
  }

  async deleteClub(clubId: string): Promise<void> {
    // Optional: check if club has members other than owner
    const members = await clubStorage.getClubMembers(clubId);
    if (members.length > 1) {
      throw new Error('멤버가 있는 클럽은 삭제할 수 없습니다. 먼저 멤버를 퇴출해주세요.');
    }
    return await clubStorage.deleteClub(clubId);
  }

  // ===== Invite Link =====

  getInviteLink(inviteCode: string): string {
    const origin = window.location.origin;
    return `${origin}/club/join/${inviteCode}`;
  }

  async getClubByInviteCode(inviteCode: string): Promise<Club | null> {
    return await clubStorage.getClubByInviteCode(inviteCode);
  }

  // ===== Member Management =====

  async joinClub(clubId: string): Promise<void> {
    return await clubStorage.joinClub(clubId);
  }

  async leaveClub(clubId: string): Promise<void> {
    return await clubStorage.leaveClub(clubId);
  }

  async getClubMembers(clubId: string): Promise<ClubMemberWithUser[]> {
    return await clubStorage.getClubMembers(clubId);
  }

  async updateMemberRole(memberId: string, newRole: 'admin' | 'member'): Promise<void> {
    return await clubStorage.updateMemberRole(memberId, newRole);
  }

  async removeMember(memberId: string): Promise<void> {
    return await clubStorage.removeMember(memberId);
  }

  // ===== Feed Management =====

  async shareWorkoutToClub(clubId: string, workoutLogId: string): Promise<void> {
    return await clubStorage.shareWorkoutToClub(clubId, workoutLogId);
  }

  async getClubFeeds(
    clubId: string,
    limit?: number,
    offset?: number
  ): Promise<ClubFeedWithDetails[]> {
    return await clubStorage.getClubFeeds(clubId, limit, offset);
  }

  async unshareWorkout(feedId: string): Promise<void> {
    return await clubStorage.unshareWorkout(feedId);
  }

  // ===== Kakao Share =====

  shareToKakao(club: Club): void {
    const inviteLink = this.getInviteLink(club.invite_code);

    // Check if Kakao SDK is available and initialized
    if (window.Kakao && window.Kakao.isInitialized()) {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${club.name} 클럽에 초대합니다!`,
          description: club.description || '함께 운동하며 챌린지를 완료해보세요!',
          imageUrl: 'https://via.placeholder.com/300x200.png?text=Workout+Club',
          link: {
            mobileWebUrl: inviteLink,
            webUrl: inviteLink,
          },
        },
        buttons: [
          {
            title: '클럽 가입하기',
            link: {
              mobileWebUrl: inviteLink,
              webUrl: inviteLink,
            },
          },
        ],
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(inviteLink);
      alert('초대 링크가 복사되었습니다!');
    }
  }
}

export default new ClubService();
