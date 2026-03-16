import * as clubStorage from '../storage/clubStorage';
import { formatDate } from '../storage/clubStorage';
import type { ClubChallenge, ChallengeDetailWithContributors } from '../types';
import type { CreateChallengeDTO } from '../types/challenge';

class ChallengeService {
  async createChallenge(data: CreateChallengeDTO): Promise<ClubChallenge> {
    // Business logic validation
    if (data.title.trim().length < 3) {
      throw new Error('챌린지 제목은 최소 3자 이상이어야 합니다.');
    }
    if (data.rules.goal_value <= 0) {
      throw new Error('목표 값은 0보다 커야 합니다.');
    }

    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    if (endDate <= startDate) {
      throw new Error('종료일은 시작일보다 이후여야 합니다.');
    }

    return await clubStorage.createChallenge(data);
  }

  async getActiveChallenges(clubId: string): Promise<ClubChallenge[]> {
    return await clubStorage.getActiveChallenges(clubId);
  }

  async getChallengeDetail(challengeId: string): Promise<ChallengeDetailWithContributors> {
    return await clubStorage.getChallengeDetail(challengeId);
  }

  async contributeToChallenge(challengeId: string, workoutLogId: string): Promise<void> {
    return await clubStorage.contributeToChallenge(challengeId, workoutLogId);
  }

  async updateChallenge(
    challengeId: string,
    updates: Partial<Pick<ClubChallenge, 'title' | 'description' | 'status'>>
  ): Promise<void> {
    if (updates.title && updates.title.trim().length < 3) {
      throw new Error('챌린지 제목은 최소 3자 이상이어야 합니다.');
    }
    return await clubStorage.updateChallenge(challengeId, updates);
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    return await clubStorage.deleteChallenge(challengeId);
  }

  // Calculate progress percentage
  calculateProgress(current: number, target: number): number {
    if (target === 0) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  }

  // Check and auto-update challenge status
  async checkAndUpdateChallengeStatus(challengeId: string): Promise<void> {
    const challenge = await clubStorage.getChallengeDetail(challengeId);

    const today = formatDate(new Date());
    const endDate = challenge.end_date;

    if (challenge.status === 'active') {
      // Goal achieved
      if (challenge.current_value >= challenge.target_value) {
        await clubStorage.updateChallenge(challengeId, { status: 'completed' });
      }
      // Period ended
      else if (today > endDate) {
        await clubStorage.updateChallenge(challengeId, { status: 'failed' });
      }
    }
  }
}

export default new ChallengeService();
