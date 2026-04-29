import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronLeft } from 'lucide-react';
import challengeService from '../services/challengeService';
import type { Challenge } from '../services/challengeService';
import workoutTypeService from '../services/workoutTypeService';
import type { WorkoutType } from '../services/workoutTypeService';

interface Props {
  challenge: Challenge;
  userId: string;
  onClose: () => void;
  onJoined: () => void;
}

interface GoalEntry {
  type: WorkoutType;
  subType: string;
  targetValue: string;
}

type Step = 'list' | 'add';

export const ChallengeJoinModal = ({ challenge, userId, onClose, onJoined }: Props) => {
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [step, setStep] = useState<Step>('list');

  // 추가 폼 상태
  const [selectedType, setSelectedType] = useState<WorkoutType | null>(null);
  const [selectedSubType, setSelectedSubType] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [formError, setFormError] = useState('');
  const [showOtherWorkouts, setShowOtherWorkouts] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    workoutTypeService.getActiveWorkoutTypes().then((types) => {
      if (challenge.allowed_categories && challenge.allowed_categories.length > 0) {
        setWorkoutTypes(types.filter((t) => challenge.allowed_categories!.includes(t.name)));
      } else {
        setWorkoutTypes(types);
      }
    });
  }, [challenge.allowed_categories]);

  const handleTypeSelect = (type: WorkoutType) => {
    setSelectedType(type);
    setSelectedSubType('');
    setTargetValue('');
    setFormError('');
  };

  const handleAddConfirm = () => {
    if (!selectedType) { setFormError('종목을 선택해주세요.'); return; }
    if (selectedType.sub_types.length > 0 && !selectedSubType) {
      setFormError('세부 종목을 선택해주세요.'); return;
    }
    const value = parseFloat(targetValue);
    if (!targetValue || isNaN(value) || value <= 0) {
      setFormError('목표값을 올바르게 입력해주세요.'); return;
    }

    const isDuplicate = goals.some(
      (g) => g.type.name === selectedType.name && g.subType === selectedSubType
    );
    if (isDuplicate) {
      setFormError('이미 추가한 종목입니다.'); return;
    }

    setGoals((prev) => [...prev, { type: selectedType, subType: selectedSubType, targetValue }]);
    setStep('list');
    setSelectedType(null);
    setSelectedSubType('');
    setTargetValue('');
    setFormError('');
    setShowOtherWorkouts(false);
  };

  const handleRemoveGoal = (idx: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (goals.length === 0) { setSubmitError('종목을 하나 이상 추가해주세요.'); return; }
    setSubmitting(true);
    try {
      for (const g of goals) {
        await challengeService.joinChallenge({
          challenge_id: challenge.id,
          user_id: userId,
          category: g.type.name,
          sub_type: g.subType || null,
          target_value: parseFloat(g.targetValue),
          unit: g.type.unit,
        });
      }
      onJoined();
    } catch {
      setSubmitError('선언 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const coreTypes = workoutTypes.filter((t) => t.is_core);
  const otherTypes = workoutTypes.filter((t) => !t.is_core);

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet challenge-join-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />

        <div className="race-modal-header">
          {step === 'add' ? (
            <button
              className="challenge-join-back-btn"
              onClick={() => { setStep('list'); setFormError(''); setSelectedType(null); setShowOtherWorkouts(false); }}
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div style={{ width: 28 }} />
          )}
          <h3>
            {step === 'list' ? '참여 선언' : '종목 추가'}
          </h3>
          <button className="race-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {step === 'list' && (
          <div className="challenge-join-body">
            <p className="challenge-join-challenge-name">{challenge.title}</p>

            {goals.length === 0 ? (
              <p className="challenge-join-empty">아직 선언한 종목이 없습니다.</p>
            ) : (
              <div className="challenge-join-goals">
                {goals.map((g, idx) => (
                  <div key={idx} className="challenge-join-goal-row">
                    <span className="challenge-join-goal-name">
                      {g.type.emoji} {g.type.name}
                      {g.subType && ` · ${g.subType}`}
                    </span>
                    <span className="challenge-join-goal-value">
                      {g.targetValue} {g.type.unit}
                    </span>
                    <button
                      className="challenge-join-goal-remove"
                      onClick={() => handleRemoveGoal(idx)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button className="challenge-join-add-btn" onClick={() => setStep('add')}>
              <Plus size={15} />
              {goals.length === 0 ? '종목 추가하기' : '더 추가하기'}
            </button>

            {submitError && <p className="challenge-create-error">{submitError}</p>}

            <button
              className="challenge-create-submit"
              onClick={handleSubmit}
              disabled={submitting || goals.length === 0}
            >
              {submitting ? '등록 중...' : `선언하기 (${goals.length}개 종목)`}
            </button>
          </div>
        )}

        {step === 'add' && (
          <div className="challenge-join-body">
            {/* 기본운동 */}
            <div className="challenge-join-section">
              <div className="challenge-join-section-label">⭐ 기본운동</div>
              <div className="challenge-category-chips">
                {coreTypes.map((type) => (
                  <button
                    key={type.id}
                    className={`challenge-category-chip ${selectedType?.id === type.id ? 'active' : ''}`}
                    onClick={() => handleTypeSelect(type)}
                  >
                    {type.emoji} {type.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 기타운동 (접힘/펼침) */}
            {otherTypes.length > 0 && (
              <div className="challenge-join-section">
                <button
                  className="challenge-join-other-toggle"
                  onClick={() => setShowOtherWorkouts(!showOtherWorkouts)}
                >
                  <span>📦 기타운동</span>
                  <span>{showOtherWorkouts ? '▼' : '▶'}</span>
                </button>
                {showOtherWorkouts && (
                  <div className="challenge-category-chips">
                    {otherTypes.map((type) => (
                      <button
                        key={type.id}
                        className={`challenge-category-chip ${selectedType?.id === type.id ? 'active' : ''}`}
                        onClick={() => handleTypeSelect(type)}
                      >
                        {type.emoji} {type.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 세부 종목 */}
            {selectedType && selectedType.sub_types.length > 0 && (
              <div className="challenge-join-section">
                <div className="challenge-join-section-label">세부 종목</div>
                <div className="challenge-category-chips">
                  {selectedType.sub_types.map((st) => (
                    <button
                      key={st.name}
                      className={`challenge-category-chip ${selectedSubType === st.name ? 'active' : ''}`}
                      onClick={() => setSelectedSubType(st.name)}
                    >
                      {st.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 목표값 */}
            {selectedType && (
              <div className="challenge-join-section">
                <div className="challenge-join-section-label">목표 누적량</div>
                <div className="challenge-join-value-row">
                  <input
                    type="number"
                    className="race-input challenge-join-value-input"
                    placeholder={selectedType.unit === 'km' ? '30' : '150'}
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    min="0"
                    step={selectedType.unit === 'km' ? '0.1' : '1'}
                  />
                  <span className="challenge-join-unit">{selectedType.unit}</span>
                </div>
                <p className="challenge-join-hint">
                  {challenge.start_date} ~ {challenge.end_date} 기간 누적 합산
                </p>
              </div>
            )}

            {formError && <p className="challenge-create-error">{formError}</p>}

            <button
              className="challenge-create-submit"
              onClick={handleAddConfirm}
              disabled={!selectedType}
            >
              추가하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
