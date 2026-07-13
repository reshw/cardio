import { useState, useEffect, useCallback } from 'react';
import { X, Shuffle, Crown } from 'lucide-react';
import teamMatchService from '../services/teamMatchService';
import type { ChallengeTeam } from '../services/teamMatchService';
import clubService from '../services/clubService';
import type { MyClubWithOrder } from '../services/clubService';

interface Props {
  challengeId: string;
  club: MyClubWithOrder;
  startDate: string;
  baselineMonths?: number;
  onClose: () => void;
  onSaved: () => void;
}

interface MemberRow {
  user_id: string;
  name: string;
  baseline: number;   // 최근 N개월 합산 마일리지
}

const dotStyle = (color: string, needsBorder: boolean) => ({
  background: color,
  border: needsBorder ? '1px solid #94a3b8' : 'none',
});

const isLight = (hex: string) => hex.toLowerCase() === '#e2e8f0';

export const TeamAssignModal = ({ challengeId, club, startDate, baselineMonths = 3, onClose, onSaved }: Props) => {
  const [teams, setTeams] = useState<ChallengeTeam[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignment, setAssignment] = useState<Record<string, string | null>>({});
  const [captains, setCaptains] = useState<Record<string, string>>({}); // teamId -> userId
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ teams: t, members: existing }, clubMembers, baseline] = await Promise.all([
        teamMatchService.getTeamsWithMembers(challengeId),
        clubService.getClubMembers(club.id),
        teamMatchService.getBaselineMileage(club.id, startDate, baselineMonths),
      ]);

      console.log('[team_match] 배정모달 로드 — 팀 수=', t.length, '기존 배정=', existing.length, 'clubMembers=', clubMembers.length);
      setTeams(t);

      const rows: MemberRow[] = clubMembers.map((m: any) => ({
        user_id: m.user_id,
        name: m.club_nickname || m.user?.display_name || '(이름 없음)',
        baseline: Math.round((baseline[m.user_id] || 0) * 10) / 10,
      })).sort((a: MemberRow, b: MemberRow) => b.baseline - a.baseline);
      setMembers(rows);

      const asg: Record<string, string | null> = {};
      const caps: Record<string, string> = {};
      rows.forEach((r) => { asg[r.user_id] = null; });
      existing.forEach((em) => {
        asg[em.user_id] = em.team_id;
        if (em.is_captain) caps[em.team_id] = em.user_id;
      });
      setAssignment(asg);
      setCaptains(caps);
    } catch (e) {
      console.error('팀 배정 로드 실패:', e);
      setError('불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [challengeId, club.id, startDate, baselineMonths]);

  useEffect(() => { load(); }, [load]);

  const runDraft = async () => {
    if (teams.length === 0) {
      setError('팀이 없습니다. 이 매치는 팀 생성이 누락되었습니다. (아래 "팀 없음" 참고)');
      console.error('[team_match] 드래프트 불가 — teams 비어있음. challengeId=', challengeId);
      return;
    }
    if (!confirm('자동 드래프트를 실행하면 현재 배정이 모두 교체됩니다. 진행할까요?')) return;
    try {
      console.log('[team_match] 드래프트 시작, teams=', teams.length, 'members=', members.length);
      const result = await teamMatchService.computeSnakeDraft(club.id, startDate, teams, baselineMonths);
      console.log('[team_match] 드래프트 결과 배정 수=', result.length);
      const asg: Record<string, string | null> = {};
      members.forEach((r) => { asg[r.user_id] = null; });
      result.forEach((r) => { asg[r.user_id] = r.team_id; });
      setAssignment(asg);
      setCaptains({});
    } catch (e: any) {
      console.error('[team_match] 드래프트 실패 상세:', JSON.stringify(e), e);
      setError(`자동 드래프트 실패: ${e?.message || e?.hint || JSON.stringify(e)}`);
    }
  };

  const setMemberTeam = (userId: string, teamId: string | null) => {
    setAssignment((prev) => ({ ...prev, [userId]: teamId }));
    // 팀에서 빠지면 팀장 해제
    if (teamId === null) {
      setCaptains((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((tid) => { if (next[tid] === userId) delete next[tid]; });
        return next;
      });
    }
  };

  const toggleCaptain = (teamId: string, userId: string) => {
    setCaptains((prev) => ({
      ...prev,
      [teamId]: prev[teamId] === userId ? '' : userId,
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const assignments = Object.entries(assignment)
        .filter(([, teamId]) => teamId !== null)
        .map(([userId, teamId]) => ({
          user_id: userId,
          team_id: teamId as string,
          is_captain: captains[teamId as string] === userId,
          joined_via: 'auto' as const,
        }));
      await teamMatchService.replaceAssignments(challengeId, assignments);
      onSaved();
    } catch (e: any) {
      console.error('[team_match] 배정 저장 실패 상세:', JSON.stringify(e), e);
      setError(`저장 실패: ${e?.message || e?.hint || JSON.stringify(e)}`);
    } finally {
      setSaving(false);
    }
  };

  // 팀별 요약 (배정 인원 / 기준 평균)
  const teamSummary = (teamId: string) => {
    const assigned = members.filter((m) => assignment[m.user_id] === teamId);
    const recorded = assigned.filter((m) => m.baseline > 0);
    const total = assigned.reduce((s, m) => s + m.baseline, 0);
    const avg = recorded.length > 0 ? Math.round((total / recorded.length) * 10) / 10 : 0;
    return { count: assigned.length, avg };
  };

  const unassignedCount = members.filter((m) => assignment[m.user_id] === null).length;

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet team-assign-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />

        <div className="race-modal-header">
          <h3>팀 배정</h3>
          <button className="race-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {loading ? (
          <p className="team-assign-loading">불러오는 중...</p>
        ) : (
          <div className="team-assign-body">
            {/* 자동 드래프트 */}
            <button className="team-draft-btn" onClick={runDraft}>
              <Shuffle size={15} /> 자동 드래프트 (최근 {baselineMonths}개월 기준)
            </button>
            <p className="team-assign-note">
              기록 보유자를 실력순 지그재그로 균형 배정합니다. 무기록자는 미배정으로 남아 본인이 팀을 고를 수 있습니다.
            </p>

            {/* 팀 요약 카드 */}
            <div className="team-summary-row">
              {teams.map((t) => {
                const s = teamSummary(t.id);
                return (
                  <div key={t.id} className="team-summary-card">
                    <span className="team-color-dot" style={dotStyle(t.color, isLight(t.color))} />
                    <span className="team-summary-name">{t.name}</span>
                    <span className="team-summary-stat">{s.count}명 · 평균 {s.avg}</span>
                  </div>
                );
              })}
            </div>

            {/* 멤버 배정 리스트 */}
            <div className="team-member-list">
              <div className="team-member-list-head">
                <span>멤버 ({members.length}) · 미배정 {unassignedCount}</span>
              </div>
              {members.map((m) => {
                const cur = assignment[m.user_id];
                return (
                  <div key={m.user_id} className="team-member-row">
                    <div className="team-member-info">
                      <span className="team-member-name">{m.name}</span>
                      <span className="team-member-baseline">{m.baseline > 0 ? `${m.baseline}` : '기록 없음'}</span>
                    </div>
                    <div className="team-member-picks">
                      <button
                        className={`team-pick-btn ${cur === null ? 'active' : ''}`}
                        onClick={() => setMemberTeam(m.user_id, null)}
                        title="미배정"
                      >
                        —
                      </button>
                      {teams.map((t) => (
                        <button
                          key={t.id}
                          className={`team-pick-dot ${cur === t.id ? 'active' : ''}`}
                          style={dotStyle(t.color, isLight(t.color))}
                          onClick={() => setMemberTeam(m.user_id, t.id)}
                          title={t.name}
                        />
                      ))}
                      {cur && (
                        <button
                          className={`team-captain-btn ${captains[cur] === m.user_id ? 'active' : ''}`}
                          onClick={() => toggleCaptain(cur, m.user_id)}
                          title="팀장"
                        >
                          <Crown size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <p className="challenge-create-error">{error}</p>}

            <button className="challenge-create-submit" onClick={save} disabled={saving}>
              {saving ? '저장 중...' : '배정 저장'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
