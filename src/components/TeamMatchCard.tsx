import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trash2, Users, Crown } from 'lucide-react';
import challengeService from '../services/challengeService';
import type { Challenge } from '../services/challengeService';
import teamMatchService from '../services/teamMatchService';
import type { ChallengeTeam, TeamStanding } from '../services/teamMatchService';
import { useConfirm } from '../hooks/useConfirm';

type MatchResults = Awaited<ReturnType<typeof teamMatchService.getMatchResults>>;

interface Props {
  challenge: Challenge;
  userId: string;
  isManager: boolean;
  onReassign: (challenge: Challenge) => void;
  onChanged: () => void;
}

const isLight = (hex: string) => hex.toLowerCase() === '#e2e8f0';
const dotStyle = (color: string) => ({
  background: color,
  border: isLight(color) ? '1px solid #94a3b8' : 'none',
});

type TeamMember = { user_id: string; name: string; mileage: number; is_captain: boolean };

export const TeamMatchCard = ({ challenge, userId, isManager, onReassign, onChanged }: Props) => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [teams, setTeams] = useState<ChallengeTeam[]>([]);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [membersByTeam, setMembersByTeam] = useState<Record<string, TeamMember[]>>({});
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myMileage, setMyMileage] = useState(0);
  const [results, setResults] = useState<MatchResults>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const ended = challengeService.isEnded(challenge.end_date);
  const upcoming = challengeService.isUpcoming(challenge.start_date);
  const daysLeft = challengeService.getDaysLeft(challenge.end_date);
  const daysUntilStart = upcoming ? challengeService.getDaysUntilStart(challenge.start_date) : 0;
  const duration = challengeService.getChallengeDuration(challenge.start_date, challenge.end_date);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await teamMatchService.getMatchDetail(challenge, userId);
      setTeams(detail.teams);
      setStandings(detail.standings);
      setMembersByTeam(detail.membersByTeam);
      setMyTeamId(detail.myTeamId);
      setMyMileage(detail.myMileage);
      if (challengeService.isEnded(challenge.end_date)) {
        teamMatchService.getMatchResults(challenge, userId).then(setResults).catch(() => {});
      }
    } catch (e) {
      console.error('팀매치 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [challenge, userId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!(await confirm('팀 대항전을 삭제하시겠습니까? 팀 구성도 모두 삭제됩니다.'))) return;
    await challengeService.deleteChallenge(challenge.id);
    onChanged();
  };

  const handleSelfJoin = async (teamId: string) => {
    setJoining(true);
    try {
      await teamMatchService.joinTeamSelf(challenge.id, teamId, userId);
      await load();
    } catch (e) {
      console.error('팀 선택 실패:', e);
      alert('팀 선택에 실패했습니다. 이미 배정되었거나 참여 불가 상태일 수 있습니다.');
    } finally {
      setJoining(false);
    }
  };

  const maxAvg = Math.max(1, ...standings.map((s) => s.avgMileage));
  const myTeam = teams.find((t) => t.id === myTeamId);
  const myStanding = standings.find((s) => s.team.id === myTeamId);

  if (loading) return null;

  return (
    <div className={`team-match-card ${ended ? 'ended' : ''} ${upcoming ? 'upcoming' : ''}`}>
      {/* 헤더 */}
      <div className="team-match-header" onClick={() => setExpanded((v) => !v)}>
        <div className="team-match-meta">
          <span className="team-match-title">
            <span className="team-match-badge">팀전</span>
            {challenge.title}
          </span>
          <span className="team-match-period">
            {challenge.start_date.replace(/-/g, '.')} ~ {challenge.end_date.replace(/-/g, '.')}
            <span className="challenge-duration">({duration}일간)</span>
            {upcoming && <span className="challenge-upcoming-badge"> · D-{daysUntilStart} 시작 예정</span>}
            {!upcoming && !ended && <span className={`team-dday ${daysLeft <= 3 ? 'urgent' : ''}`}> · D-{daysLeft}</span>}
            {ended && <span className="challenge-ended-badge"> · 종료</span>}
          </span>
        </div>
        <div className="challenge-card-right">
          {isManager && (
            <>
              <button
                className="team-reassign-icon"
                onClick={(e) => { e.stopPropagation(); onReassign(challenge); }}
                title="팀 재배정"
              >
                <Users size={15} />
              </button>
              {!ended && (
                <button
                  className="challenge-delete-icon"
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* 팀 순위 보드 (레이스 트랙) */}
      <div className="team-standings">
        {standings.map((s) => (
          <div key={s.team.id} className="team-standing-row">
            <span className="team-standing-emblem" style={dotStyle(s.team.color)}>
              {s.rank === 1 && <Crown size={11} className="team-crown" />}
            </span>
            <span className="team-standing-name">{s.team.name}</span>
            <div className="team-standing-track">
              <div
                className={`team-standing-fill ${s.rank === 1 ? 'leader' : ''}`}
                style={{ width: `${Math.round((s.avgMileage / maxAvg) * 100)}%`, background: isLight(s.team.color) ? '#cbd5e1' : s.team.color }}
              />
            </div>
            <span className="team-standing-avg">{s.avgMileage}</span>
          </div>
        ))}
      </div>

      {/* 종료 결과·시상 */}
      {ended && results && (
        <div className="team-result-card" style={{ borderColor: isLight(results.winner!.team.color) ? '#94a3b8' : results.winner!.team.color }}>
          <div className="team-result-winner">
            <Crown size={15} className="team-result-crown" />
            우승 <b>{results.winner!.team.name}</b> · 1인 평균 {results.winner!.avgMileage}
          </div>
          {results.mvp && (
            <div className="team-result-award">
              <span className="team-result-label">MVP</span>
              {results.mvp.name} <span className="team-result-sub">{results.mvp.teamName} · {results.mvp.mileage}</span>
            </div>
          )}
          {results.comeback && (
            <div className="team-result-award">
              <span className="team-result-label">아차상</span>
              {results.comeback.name} <span className="team-result-sub">성장률 +{results.comeback.growthPct}%</span>
            </div>
          )}
        </div>
      )}

      {/* 내 팀 / 기여 or 팀 선택 */}
      {myTeam ? (
        <div className="team-my-band" style={{ borderColor: isLight(myTeam.color) ? '#94a3b8' : myTeam.color }}>
          <span className="team-color-dot" style={dotStyle(myTeam.color)} />
          내 팀 <b>{myTeam.name}</b>
          {!upcoming && (
            <> · 내 기여 {myMileage}
              {myStanding && myStanding.avgMileage > 0 && (
                <span className="team-my-diff">
                  {myMileage >= myStanding.avgMileage
                    ? ` (팀 평균 +${Math.round((myMileage - myStanding.avgMileage) * 10) / 10})`
                    : ` (팀 평균까지 ${Math.round((myStanding.avgMileage - myMileage) * 10) / 10})`}
                </span>
              )}
            </>
          )}
        </div>
      ) : !ended ? (
        <div className="team-pick-panel">
          <span className="team-pick-label">아직 배정되지 않았어요. 팀을 골라 합류하세요!</span>
          <div className="team-pick-choices">
            {teams.map((t) => {
              const cnt = membersByTeam[t.id]?.length || 0;
              return (
                <button
                  key={t.id}
                  className="team-pick-choice"
                  disabled={joining}
                  onClick={() => handleSelfJoin(t.id)}
                >
                  <span className="team-color-dot" style={dotStyle(t.color)} />
                  {t.name} <span className="team-pick-count">{cnt}명</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 상세: 팀별 팀원 기여 */}
      {expanded && (
        <div className="team-match-detail">
          {teams.map((t) => (
            <div key={t.id} className="team-detail-block">
              <div className="team-detail-head">
                <span className="team-color-dot" style={dotStyle(t.color)} />
                <span className="team-detail-name">{t.name}</span>
                <span className="team-detail-count">{membersByTeam[t.id]?.length || 0}명</span>
              </div>
              {(membersByTeam[t.id] || []).map((m) => (
                <div key={m.user_id} className={`team-detail-member ${m.user_id === userId ? 'me' : ''}`}>
                  <span className="team-detail-member-name">
                    {m.is_captain && <Crown size={11} className="team-captain-mark" />}
                    {m.name}{m.user_id === userId && ' (나)'}
                  </span>
                  <span className="team-detail-member-mileage">{m.mileage}</span>
                </div>
              ))}
              {(membersByTeam[t.id]?.length || 0) === 0 && (
                <div className="team-detail-empty">아직 팀원이 없습니다</div>
              )}
            </div>
          ))}
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
};
