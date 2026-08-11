import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import challengeService from '../services/challengeService';
import type { ChallengeType } from '../services/challengeService';
import teamMatchService, { TEAM_PRESETS, DEFAULT_TEAM_MATCH_META } from '../services/teamMatchService';
import type { MyClubWithOrder } from '../services/clubService';
import workoutTypeService from '../services/workoutTypeService';
import type { WorkoutType } from '../services/workoutTypeService';
import { useModalHistory } from '../hooks/useModalHistory';

interface Props {
  club: MyClubWithOrder;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
  // 팀 대항전 생성 완료 시 배정 모달을 열도록 정보 전달
  onTeamMatchCreated?: (info: { id: string; startDate: string; baselineMonths: number }) => void;
}

export const ChallengeCreateModal = ({ club, userId, onClose, onCreated, onTeamMatchCreated }: Props) => {
  useModalHistory(true, onClose);
  const today = new Date().toISOString().split('T')[0];
  const [challengeType, setChallengeType] = useState<ChallengeType>('personal_goal');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [allAllowed, setAllAllowed] = useState(true);
  const [allowLateJoin, setAllowLateJoin] = useState(false);
  // 팀 대항전 전용
  const [teamCount, setTeamCount] = useState(2);
  const [recordedOnly, setRecordedOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isTeamMatch = challengeType === 'team_match';

  useEffect(() => {
    workoutTypeService.getActiveWorkoutTypes().then(setWorkoutTypes);
  }, []);

  const toggleCategory = (name: string) => {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('챌린지 이름을 입력해주세요.'); return; }
    if (!endDate) { setError('종료일을 입력해주세요.'); return; }
    if (endDate < startDate) { setError('종료일이 시작일보다 빠를 수 없습니다.'); return; }

    if (isTeamMatch) {
      setSubmitting(true);
      try {
        console.log('[team_match] 생성 시작 — 1단계 챌린지 생성');
        const challenge = await challengeService.createTeamMatch({
          club_id: club.id,
          created_by: userId,
          title: title.trim(),
          start_date: startDate,
          end_date: endDate,
          meta: {
            ...DEFAULT_TEAM_MATCH_META,
            avg_denominator: recordedOnly ? 'recorded' : 'all',
          },
        });
        console.log('[team_match] 2단계 팀 생성 시작, challengeId=', challenge.id);
        await teamMatchService.createTeams(
          challenge.id,
          TEAM_PRESETS.slice(0, teamCount).map((p) => ({ name: p.name, color: p.color }))
        );
        console.log('[team_match] 생성 완료 — 배정 모달로 이동');
        if (onTeamMatchCreated) {
          onTeamMatchCreated({
            id: challenge.id,
            startDate: challenge.start_date,
            baselineMonths: DEFAULT_TEAM_MATCH_META.baseline_months,
          });
        } else onCreated();
      } catch (err: any) {
        console.error('[team_match] 생성 실패 상세:', JSON.stringify(err), err);
        const msg = err?.message || err?.error_description || err?.hint || JSON.stringify(err);
        setError(`팀 대항전 생성 실패: ${msg}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!allAllowed && selectedCategories.length === 0) {
      setError('허용 종목을 하나 이상 선택해주세요.'); return;
    }
    setSubmitting(true);
    try {
      await challengeService.createChallenge({
        club_id: club.id,
        created_by: userId,
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        allowed_categories: allAllowed ? null : selectedCategories,
        allow_late_join: allowLateJoin,
      });
      onCreated();
    } catch {
      setError('챌린지 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet challenge-create-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />

        <div className="race-modal-header">
          <h3>{isTeamMatch ? '팀 대항전 만들기' : '챌린지 만들기'}</h3>
          <button className="race-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="race-form">
          {/* 타입 선택 */}
          <div className="race-form-group">
            <label>유형</label>
            <div className="challenge-allowed-row">
              <button
                className={`challenge-scope-btn ${!isTeamMatch ? 'active' : ''}`}
                onClick={() => setChallengeType('personal_goal')}
              >
                개인 목표
              </button>
              <button
                className={`challenge-scope-btn ${isTeamMatch ? 'active' : ''}`}
                onClick={() => setChallengeType('team_match')}
              >
                팀 대항전
              </button>
            </div>
          </div>

          {/* 챌린지 이름 */}
          <div className="race-form-group">
            <label>{isTeamMatch ? '매치 이름' : '챌린지 이름'}</label>
            <input
              className="race-input"
              placeholder={isTeamMatch ? '예: 7월 팀 대항 마일리지 매치' : '예: 5월 연휴 챌린지!'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
            />
          </div>

          {/* 기간 */}
          <div className="race-form-row">
            <div className="race-form-group">
              <label>시작일</label>
              <input
                type="date"
                className="race-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="race-form-group">
              <label>종료일</label>
              <input
                type="date"
                className="race-input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* ===== 팀 대항전 전용 ===== */}
          {isTeamMatch && (
            <>
              <div className="race-form-group">
                <label>팀 수</label>
                <div className="challenge-allowed-row">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      className={`challenge-scope-btn ${teamCount === n ? 'active' : ''}`}
                      onClick={() => setTeamCount(n)}
                    >
                      {n}팀
                    </button>
                  ))}
                </div>
                <div className="team-preset-preview">
                  {TEAM_PRESETS.slice(0, teamCount).map((p) => (
                    <span key={p.name} className="team-preset-chip">
                      <span
                        className="team-color-dot"
                        style={{
                          background: p.color,
                          border: p.needsBorder ? '1px solid #94a3b8' : 'none',
                        }}
                      />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>

              <label className="challenge-toggle-row">
                <span className="challenge-toggle-label">
                  기록 보유자만 평균 계산
                  <span className="challenge-toggle-hint">끄면 배정 전원으로 나눔 (무기록자 포함)</span>
                </span>
                <input
                  type="checkbox"
                  className="challenge-toggle-input"
                  checked={recordedOnly}
                  onChange={(e) => setRecordedOnly(e.target.checked)}
                />
                <span className={`challenge-toggle-track ${recordedOnly ? 'on' : ''}`} />
              </label>

              <p className="team-match-hint">
                생성 후 팀 배정 화면으로 이동합니다. 자동 드래프트로 최근 3개월 기록 기준 균형 배정 후 조정할 수 있습니다.
              </p>
            </>
          )}

          {/* 허용 종목 (개인 목표 전용) */}
          {!isTeamMatch && (
          <>
          <div className="race-form-group">
            <label>허용 종목</label>
            <div className="challenge-allowed-row">
              <button
                className={`challenge-scope-btn ${allAllowed ? 'active' : ''}`}
                onClick={() => setAllAllowed(true)}
              >
                전체
              </button>
              <button
                className={`challenge-scope-btn ${!allAllowed ? 'active' : ''}`}
                onClick={() => setAllAllowed(false)}
              >
                직접 선택
              </button>
            </div>
            {!allAllowed && (
              <div className="challenge-category-chips">
                {workoutTypes.map((type) => (
                  <button
                    key={type.id}
                    className={`challenge-category-chip ${selectedCategories.includes(type.name) ? 'active' : ''}`}
                    onClick={() => toggleCategory(type.name)}
                  >
                    {type.emoji} {type.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 시작 후 참여 허용 */}
          <label className="challenge-toggle-row">
            <span className="challenge-toggle-label">
              시작 후 참여 허용
              <span className="challenge-toggle-hint">끄면 시작일 이후 신규 참여 불가</span>
            </span>
            <input
              type="checkbox"
              className="challenge-toggle-input"
              checked={allowLateJoin}
              onChange={(e) => setAllowLateJoin(e.target.checked)}
            />
            <span className={`challenge-toggle-track ${allowLateJoin ? 'on' : ''}`} />
          </label>
          </>
          )}

          {error && <p className="challenge-create-error">{error}</p>}

          <button
            className="challenge-create-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '생성 중...' : isTeamMatch ? '팀 배정하러 가기' : '챌린지 열기'}
          </button>
        </div>
      </div>
    </div>
  );
};
