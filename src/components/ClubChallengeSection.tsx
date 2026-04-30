import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search, X, Plus, Trash2, BarChart2 } from 'lucide-react';
import challengeService from '../services/challengeService';
import type { Challenge, ChallengeParticipant, UserProgress } from '../services/challengeService';
import type { MyClubWithOrder } from '../services/clubService';
import { ChallengeCreateModal } from './ChallengeCreateModal';
import { ChallengeJoinModal } from './ChallengeJoinModal';
import { ChallengeStatsModal } from './ChallengeStatsModal';

interface Props {
  club: MyClubWithOrder;
  userId: string;
  isManager: boolean;
}

interface ChallengeState {
  challenge: Challenge;
  expanded: boolean;
  myParticipants: ChallengeParticipant[];
  myOverallPct: number;
  usersProgress: UserProgress[];
  participantsLoaded: boolean;
}

export const ClubChallengeSection = ({ club, userId, isManager }: Props) => {
  const [challengeStates, setChallengeStates] = useState<ChallengeState[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joiningChallenge, setJoiningChallenge] = useState<Challenge | null>(null);
  const [statsChallenge, setStatsChallenge] = useState<Challenge | null>(null);

  const loadChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const challenges = await challengeService.getActiveChallengesForClub(club.id).catch(() => []);
      const states: ChallengeState[] = await Promise.all(
        challenges.map(async (c) => {
          const myParticipants = await challengeService.getMyParticipants(c.id, userId).catch(() => []);
          let myOverallPct = 0;
          if (myParticipants.length > 0) {
            const progresses = await challengeService.calcMyProgressBulk(c, myParticipants).catch(() => []);
            if (progresses.length > 0) {
              myOverallPct = Math.round(progresses.reduce((sum, p) => sum + p.pct, 0) / progresses.length);
            }
          }
          return {
            challenge: c,
            expanded: false,
            myParticipants,
            myOverallPct,
            usersProgress: [],
            participantsLoaded: false,
          };
        })
      );
      setChallengeStates(states);
    } catch (e) {
      console.error('챌린지 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [club.id, userId]);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const loadParticipants = (challengeId: string, challenge: Challenge) => {
    challengeService.getParticipantsWithProgress(challenge, club.id)
      .then((prog) => {
        setChallengeStates((prev) =>
          prev.map((cs) =>
            cs.challenge.id === challengeId
              ? { ...cs, usersProgress: prog, participantsLoaded: true }
              : cs
          )
        );
      })
      .catch((err) => {
        console.error('참여자 목록 로드 실패:', err);
        setChallengeStates((prev) =>
          prev.map((cs) =>
            cs.challenge.id === challengeId
              ? { ...cs, participantsLoaded: true }
              : cs
          )
        );
      });
  };

  const toggleExpand = (challengeId: string) => {
    setChallengeStates((prev) =>
      prev.map((cs) => {
        if (cs.challenge.id !== challengeId) return cs;
        const willExpand = !cs.expanded;
        if (willExpand && !cs.participantsLoaded) {
          loadParticipants(challengeId, cs.challenge);
        }
        return { ...cs, expanded: willExpand };
      })
    );
  };

  const handleDelete = async (challengeId: string) => {
    if (!confirm('챌린지를 삭제하시겠습니까? 참여자 데이터도 모두 삭제됩니다.')) return;
    await challengeService.deleteChallenge(challengeId);
    loadChallenges();
  };

  if (loading) return null;
  if (challengeStates.length === 0 && !isManager) return null;

  return (
    <div className="challenge-section">
      <div className="challenge-section-header">
        <span className="challenge-section-title">챌린지</span>
        {isManager && (
          <button className="challenge-create-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> 만들기
          </button>
        )}
      </div>

      {challengeStates.length === 0 && (
        <p className="challenge-empty">진행 중인 챌린지가 없습니다.</p>
      )}

      {challengeStates.map((cs) => {
        const { challenge, expanded, myParticipants, myOverallPct } = cs;
        const ended = challengeService.isEnded(challenge.end_date);
        const upcoming = challengeService.isUpcoming(challenge.start_date);
        const joinLocked = !upcoming && !challenge.allow_late_join;
        const daysLeft = challengeService.getDaysLeft(challenge.end_date);
        const daysUntilStart = upcoming ? challengeService.getDaysUntilStart(challenge.start_date) : 0;
        const duration = challengeService.getChallengeDuration(challenge.start_date, challenge.end_date);
        const searchQuery = searchQueries[challenge.id] || '';
        const hasJoined = myParticipants.length > 0;

        const filteredUsers = cs.usersProgress.filter((up) =>
          up.displayName.includes(searchQuery)
        );
        const achievedCount = cs.usersProgress.filter((up) => up.allAchieved).length;

        return (
          <div key={challenge.id} className={`challenge-card-v2 ${ended ? 'ended' : ''} ${upcoming ? 'upcoming' : ''}`}>
            {/* 헤더 */}
            <div className="challenge-card-header-v2" onClick={() => toggleExpand(challenge.id)}>
              <div className="challenge-card-meta">
                <span className="challenge-card-title">{challenge.title}</span>
                <span className="challenge-card-period">
                  {challenge.start_date.replace(/-/g, '.')} ~ {challenge.end_date.replace(/-/g, '.')}
                  <span className="challenge-duration">({duration}일간)</span>
                  {upcoming && (
                    <span className="challenge-upcoming-badge"> · D-{daysUntilStart} 시작 예정</span>
                  )}
                  {!upcoming && !ended && daysLeft > 0 && (
                    <span className="challenge-days-left"> · {daysLeft}일 남음</span>
                  )}
                  {ended && <span className="challenge-ended-badge"> · 종료</span>}
                </span>
              </div>
              <div className="challenge-card-right">
                <button
                  className="challenge-stats-icon"
                  onClick={(e) => { e.stopPropagation(); setStatsChallenge(challenge); }}
                  title="기간 통계"
                >
                  <BarChart2 size={15} />
                </button>
                {isManager && !ended && (
                  <button
                    className="challenge-delete-icon"
                    onClick={(e) => { e.stopPropagation(); handleDelete(challenge.id); }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {/* 내 달성률 or 참여하기 */}
            {hasJoined ? (
              upcoming ? (
                <div className="challenge-upcoming-joined" onClick={() => toggleExpand(challenge.id)}>
                  참여 선언 완료 · {myParticipants.length}개 종목
                </div>
              ) : (
                <div className="challenge-my-progress" onClick={() => toggleExpand(challenge.id)}>
                  <div className="challenge-progress-bar-wrap">
                    <div
                      className="challenge-progress-bar-fill"
                      style={{
                        width: `${myOverallPct}%`,
                        background: myOverallPct >= 100 ? '#22c55e' : '#8b5cf6',
                      }}
                    />
                  </div>
                  <span className="challenge-my-pct">
                    내 달성률 {myOverallPct}%
                    {myParticipants.length > 1 && ` (${myParticipants.length}개 종목)`}
                  </span>
                </div>
              )
            ) : !ended && !joinLocked ? (
              <button
                className="challenge-join-btn"
                onClick={(e) => { e.stopPropagation(); setJoiningChallenge(challenge); }}
              >
                {upcoming ? '사전 참여 선언' : '참여하기'}
              </button>
            ) : !ended && joinLocked ? (
              <p className="challenge-join-locked">참여 마감 (시작 후 신규 참여 불가)</p>
            ) : null}

            {/* 접힌 상태에서 내 선언 종목 요약 */}
            {hasJoined && !expanded && myParticipants.length > 0 && (
              <div className="challenge-my-goals-summary">
                {myParticipants.map((p, idx) => (
                  <span key={idx} className="challenge-my-goal-chip">
                    {p.category}{p.sub_type ? ` · ${p.sub_type}` : ''} {p.target_value}{p.unit}
                  </span>
                ))}
              </div>
            )}

            {/* 상세 */}
            {expanded && (
              <div className="challenge-detail">
                {/* 전체 달성도 — 로드 완료 후만 표시 */}
                {cs.participantsLoaded && (
                  <div className="challenge-total-stat">
                    {cs.usersProgress.length}명 참여 · {achievedCount}명 달성
                  </div>
                )}

                {/* 내 종목별 달성도 (펼쳐진 상태에서) */}
                {hasJoined && cs.participantsLoaded && (
                  <div className="challenge-my-categories">
                    <div className="challenge-detail-label">내 목표</div>
                    {cs.usersProgress
                      .find((up) => up.user_id === userId)
                      ?.targets.map((t, idx) => (
                        <div key={idx} className="challenge-category-row">
                          <span className="challenge-category-name">
                            {t.participant.category}
                            {t.participant.sub_type && ` · ${t.participant.sub_type}`}
                          </span>
                          <div className="challenge-progress-bar-wrap small">
                            <div
                              className="challenge-progress-bar-fill"
                              style={{
                                width: `${t.pct}%`,
                                background: t.achieved ? '#22c55e' : '#8b5cf6',
                              }}
                            />
                          </div>
                          <span className="challenge-category-stat">
                            {t.current_value}/{t.participant.target_value}{t.participant.unit} · {t.pct}%{t.achieved && ' ✓'}
                          </span>
                        </div>
                      ))}
                    {!ended && (
                      <button
                        className="challenge-join-add-btn small"
                        onClick={(e) => { e.stopPropagation(); setJoiningChallenge(challenge); }}
                      >
                        <Plus size={13} /> 종목 추가
                      </button>
                    )}
                  </div>
                )}

                {/* 참여자 리스트 */}
                {!cs.participantsLoaded && (
                  <p className="challenge-participants-loading">참여자 불러오는 중...</p>
                )}
                {cs.participantsLoaded && cs.usersProgress.length > 0 && (
                  <div className="challenge-participants-section">
                    <div className="challenge-detail-label">참여자</div>
                    <div className="challenge-search-wrap">
                      <Search size={14} />
                      <input
                        className="challenge-search-input"
                        placeholder="이름 검색"
                        value={searchQuery}
                        onChange={(e) =>
                          setSearchQueries((prev) => ({ ...prev, [challenge.id]: e.target.value }))
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                      {searchQuery && (
                        <button onClick={(e) => { e.stopPropagation(); setSearchQueries((prev) => ({ ...prev, [challenge.id]: '' })); }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {filteredUsers.map((up) => {
                      const userKey = `${challenge.id}-${up.user_id}`;
                      const isExpandedUser = expandedUsers[userKey];
                      const isMe = up.user_id === userId;

                      return (
                        <div key={up.user_id} className="challenge-participant-card">
                          <div
                            className="challenge-participant-row"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedUsers((prev) => ({ ...prev, [userKey]: !prev[userKey] }));
                            }}
                          >
                            <span className="challenge-participant-name">
                              {up.displayName}{isMe && ' (나)'}
                            </span>
                            <div className="challenge-progress-bar-wrap small">
                              <div
                                className="challenge-progress-bar-fill"
                                style={{
                                  width: `${up.overallPct}%`,
                                  background: up.allAchieved ? '#22c55e' : '#8b5cf6',
                                }}
                              />
                            </div>
                            <span className={`challenge-participant-pct ${up.allAchieved ? 'achieved' : ''}`}>
                              {up.overallPct}%{up.allAchieved ? ' ✓' : ''}
                            </span>
                            {isExpandedUser ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </div>

                          {isExpandedUser && (
                            <div className="challenge-participant-targets">
                              {up.targets.map((t, idx) => (
                                <div key={idx} className="challenge-participant-detail">
                                  <span className="challenge-category-name">
                                    {t.participant.category}
                                    {t.participant.sub_type && ` · ${t.participant.sub_type}`}
                                  </span>
                                  <div className="challenge-progress-bar-wrap small">
                                    <div
                                      className="challenge-progress-bar-fill"
                                      style={{
                                        width: `${t.pct}%`,
                                        background: t.achieved ? '#22c55e' : '#8b5cf6',
                                      }}
                                    />
                                  </div>
                                  <span className="challenge-category-stat">
                                    {isMe
                                      ? `${t.current_value}/${t.participant.target_value}${t.participant.unit} · ${t.pct}%`
                                      : `${t.pct}%`}
                                    {t.achieved && ' ✓'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showCreateModal && (
        <ChallengeCreateModal
          club={club}
          userId={userId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadChallenges(); }}
        />
      )}

      {joiningChallenge && (
        <ChallengeJoinModal
          challenge={joiningChallenge}
          userId={userId}
          onClose={() => setJoiningChallenge(null)}
          onJoined={() => { setJoiningChallenge(null); loadChallenges(); }}
        />
      )}

      {statsChallenge && (
        <ChallengeStatsModal
          challenge={statsChallenge}
          clubId={club.id}
          clubName={club.name}
          isManager={isManager}
          onClose={() => setStatsChallenge(null)}
        />
      )}
    </div>
  );
};
