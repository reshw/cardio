import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Search, X, Plus, Trash2 } from 'lucide-react';
import challengeService from '../services/challengeService';
import type { Challenge, ChallengeParticipant, ParticipantProgress } from '../services/challengeService';
import type { MyClubWithOrder } from '../services/clubService';
import { ChallengeCreateModal } from './ChallengeCreateModal';
import { ChallengeJoinModal } from './ChallengeJoinModal';

interface Props {
  club: MyClubWithOrder;
  userId: string;
  isManager: boolean;
}

interface ChallengeState {
  challenge: Challenge;
  expanded: boolean;
  myParticipant: ChallengeParticipant | null;
  myProgressPct: number;
  myCurrentValue: number;
  participantsProgress: ParticipantProgress[];
  participantsLoaded: boolean;
}

export const ClubChallengeSection = ({ club, userId, isManager }: Props) => {
  const [challengeStates, setChallengeStates] = useState<ChallengeState[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [expandedParticipants, setExpandedParticipants] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joiningChallenge, setJoiningChallenge] = useState<Challenge | null>(null);

  const loadChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const challenges = await challengeService.getActiveChallengesForClub(club.id);
      const states: ChallengeState[] = await Promise.all(
        challenges.map(async (c, idx) => {
          const myParticipant = await challengeService.getMyParticipant(c.id, userId);
          let myProgressPct = 0;
          let myCurrentValue = 0;
          if (myParticipant) {
            const prog = await challengeService.getMyProgress(c, userId, myParticipant);
            myProgressPct = prog.pct;
            myCurrentValue = prog.current_value;
          }
          return {
            challenge: c,
            expanded: challenges.length === 1 && idx === 0,
            myParticipant,
            myProgressPct,
            myCurrentValue,
            participantsProgress: [],
            participantsLoaded: false,
          };
        })
      );
      setChallengeStates(states);
    } finally {
      setLoading(false);
    }
  }, [club.id, userId]);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const toggleExpand = async (challengeId: string) => {
    setChallengeStates((prev) =>
      prev.map((cs) => {
        if (cs.challenge.id !== challengeId) return cs;
        const willExpand = !cs.expanded;
        if (willExpand && !cs.participantsLoaded) {
          // 참여자 목록 로드
          challengeService.getParticipantsWithProgress(cs.challenge, club.id).then((prog) => {
            setChallengeStates((prev2) =>
              prev2.map((cs2) =>
                cs2.challenge.id === challengeId
                  ? { ...cs2, participantsProgress: prog, participantsLoaded: true }
                  : cs2
              )
            );
          });
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

  const handleJoined = () => {
    setJoiningChallenge(null);
    loadChallenges();
  };

  const handleCreated = () => {
    setShowCreateModal(false);
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
        const { challenge, expanded, myParticipant, myProgressPct, myCurrentValue } = cs;
        const ended = challengeService.isEnded(challenge.end_date);
        const daysLeft = challengeService.getDaysLeft(challenge.end_date);
        const searchQuery = searchQueries[challenge.id] || '';

        const filteredParticipants = cs.participantsProgress.filter((pp) => {
          const name =
            (pp.participant.user as any)?.club_nickname ||
            (pp.participant.user as any)?.user?.display_name ||
            '';
          return name.includes(searchQuery);
        });

        const achievedCount = cs.participantsProgress.filter((pp) => pp.achieved).length;

        return (
          <div key={challenge.id} className={`challenge-card-v2 ${ended ? 'ended' : ''}`}>
            {/* 접힌 헤더 */}
            <div className="challenge-card-header-v2" onClick={() => toggleExpand(challenge.id)}>
              <div className="challenge-card-meta">
                <span className="challenge-card-title">{challenge.title}</span>
                <span className="challenge-card-period">
                  {challenge.start_date} ~ {challenge.end_date}
                  {!ended && daysLeft > 0 && (
                    <span className="challenge-days-left"> · {daysLeft}일 남음</span>
                  )}
                  {ended && <span className="challenge-ended-badge"> · 종료</span>}
                </span>
              </div>
              <div className="challenge-card-right">
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

            {/* 내 달성률 게이지 (항상 표시) */}
            {myParticipant ? (
              <div className="challenge-my-progress" onClick={() => toggleExpand(challenge.id)}>
                <div className="challenge-progress-bar-wrap">
                  <div
                    className="challenge-progress-bar-fill"
                    style={{
                      width: `${myProgressPct}%`,
                      background: myProgressPct >= 100 ? '#22c55e' : '#8b5cf6',
                    }}
                  />
                </div>
                <span className="challenge-my-pct">
                  내 달성률 {myProgressPct}%
                </span>
              </div>
            ) : !ended ? (
              <button
                className="challenge-join-btn"
                onClick={(e) => { e.stopPropagation(); setJoiningChallenge(challenge); }}
              >
                참여하기
              </button>
            ) : null}

            {/* 펼쳐진 상세 */}
            {expanded && (
              <div className="challenge-detail">
                {/* 전체 달성도 */}
                <div className="challenge-total-stat">
                  {cs.participantsLoaded
                    ? `${cs.participantsProgress.length}명 참여 · ${achievedCount}명 달성`
                    : '불러오는 중...'}
                </div>

                {/* 내 종목별 달성도 */}
                {myParticipant && (
                  <div className="challenge-my-categories">
                    <div className="challenge-detail-label">내 목표</div>
                    <div className="challenge-category-row">
                      <span className="challenge-category-name">
                        {myParticipant.category}
                        {myParticipant.sub_type && ` · ${myParticipant.sub_type}`}
                      </span>
                      <div className="challenge-progress-bar-wrap small">
                        <div
                          className="challenge-progress-bar-fill"
                          style={{
                            width: `${myProgressPct}%`,
                            background: myProgressPct >= 100 ? '#22c55e' : '#8b5cf6',
                          }}
                        />
                      </div>
                      <span className="challenge-category-stat">
                        {myCurrentValue.toFixed(1)}/{myParticipant.target_value}{myParticipant.unit} · {myProgressPct}%
                        {myProgressPct >= 100 && ' ✓'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 참여자 리스트 */}
                {cs.participantsLoaded && cs.participantsProgress.length > 0 && (
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
                        <button
                          onClick={(e) => { e.stopPropagation(); setSearchQueries((prev) => ({ ...prev, [challenge.id]: '' })); }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {filteredParticipants.map((pp) => {
                      const participantKey = `${challenge.id}-${pp.participant.user_id}`;
                      const isExpandedPart = expandedParticipants[participantKey];
                      const isMe = pp.participant.user_id === userId;
                      const name =
                        (pp.participant.user as any)?.club_nickname ||
                        (pp.participant.user as any)?.user?.display_name ||
                        '탈퇴한 회원';

                      return (
                        <div key={pp.participant.id} className="challenge-participant-card">
                          <div
                            className="challenge-participant-row"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedParticipants((prev) => ({
                                ...prev,
                                [participantKey]: !prev[participantKey],
                              }));
                            }}
                          >
                            <span className="challenge-participant-name">
                              {name}{isMe && ' (나)'}
                            </span>
                            <div className="challenge-progress-bar-wrap small">
                              <div
                                className="challenge-progress-bar-fill"
                                style={{
                                  width: `${pp.pct}%`,
                                  background: pp.achieved ? '#22c55e' : '#8b5cf6',
                                }}
                              />
                            </div>
                            <span className={`challenge-participant-pct ${pp.achieved ? 'achieved' : ''}`}>
                              {pp.pct}%{pp.achieved ? ' ✓' : ''}
                            </span>
                            {isExpandedPart ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </div>

                          {/* 참여자 종목 상세 */}
                          {isExpandedPart && (
                            <div className="challenge-participant-detail">
                              <span className="challenge-category-name">
                                {pp.participant.category}
                                {pp.participant.sub_type && ` · ${pp.participant.sub_type}`}
                              </span>
                              <div className="challenge-progress-bar-wrap small">
                                <div
                                  className="challenge-progress-bar-fill"
                                  style={{
                                    width: `${pp.pct}%`,
                                    background: pp.achieved ? '#22c55e' : '#8b5cf6',
                                  }}
                                />
                              </div>
                              <span className="challenge-category-stat">
                                {/* 타인: 달성률%만, 본인: 실제값도 표시 */}
                                {isMe
                                  ? `${pp.current_value.toFixed(1)}/${pp.participant.target_value}${pp.participant.unit} · ${pp.pct}%`
                                  : `${pp.pct}%`}
                                {pp.achieved && ' ✓'}
                              </span>
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
          onCreated={handleCreated}
        />
      )}

      {joiningChallenge && (
        <ChallengeJoinModal
          challenge={joiningChallenge}
          userId={userId}
          onClose={() => setJoiningChallenge(null)}
          onJoined={handleJoined}
        />
      )}
    </div>
  );
};
