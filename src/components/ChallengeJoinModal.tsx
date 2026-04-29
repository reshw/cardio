import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
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

    // 중복 체크
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>참여 선언</h2>
            <p className="modal-subtitle">{challenge.title}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {step === 'list' && (
            <>
              {/* 목표 목록 */}
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

              {/* 추가 버튼 */}
              <button className="challenge-join-add-btn" onClick={() => setStep('add')}>
                <Plus size={15} />
                {goals.length === 0 ? '종목 추가하기' : '더 추가하기'}
              </button>

              {submitError && <p className="form-error">{submitError}</p>}
            </>
          )}

          {step === 'add' && (
            <>
              {/* 종목 선택 */}
              <div className="form-group">
                <label>종목</label>
                <div className="workout-type-grid">
                  {workoutTypes.map((type) => (
                    <button
                      key={type.id}
                      className={`workout-type-chip ${selectedType?.id === type.id ? 'selected' : ''}`}
                      onClick={() => handleTypeSelect(type)}
                    >
                      {type.emoji} {type.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 서브타입 */}
              {selectedType && selectedType.sub_types.length > 0 && (
                <div className="form-group">
                  <label>세부 종목</label>
                  <div className="workout-type-grid">
                    {selectedType.sub_types.map((st) => (
                      <button
                        key={st.name}
                        className={`workout-type-chip ${selectedSubType === st.name ? 'selected' : ''}`}
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
                <div className="form-group">
                  <label>목표 누적량</label>
                  <div className="input-with-unit">
                    <input
                      type="number"
                      className="form-input"
                      placeholder={selectedType.unit === 'km' ? '30' : '150'}
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      min="0"
                      step={selectedType.unit === 'km' ? '0.1' : '1'}
                    />
                    <span className="input-unit">{selectedType.unit}</span>
                  </div>
                  <p className="form-hint">
                    {challenge.start_date} ~ {challenge.end_date} 기간 누적 합산
                  </p>
                </div>
              )}

              {formError && <p className="form-error">{formError}</p>}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step === 'list' ? (
            <>
              <button className="btn-secondary" onClick={onClose}>취소</button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={submitting || goals.length === 0}
              >
                {submitting ? '등록 중...' : `선언하기 (${goals.length}개)`}
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => { setStep('list'); setFormError(''); }}>
                뒤로
              </button>
              <button className="btn-primary" onClick={handleAddConfirm}>
                확인
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
