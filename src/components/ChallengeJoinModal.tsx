import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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


export const ChallengeJoinModal = ({ challenge, userId, onClose, onJoined }: Props) => {
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [selectedType, setSelectedType] = useState<WorkoutType | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<string>('');
  const [targetValue, setTargetValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    workoutTypeService.getActiveWorkoutTypes().then((types) => {
      // allowed_categories가 있으면 해당 종목만 표시
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
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedType) { setError('종목을 선택해주세요.'); return; }
    if (selectedType.sub_types.length > 0 && !selectedSubType) {
      setError('세부 종목을 선택해주세요.'); return;
    }
    const value = parseFloat(targetValue);
    if (!targetValue || isNaN(value) || value <= 0) {
      setError('목표값을 올바르게 입력해주세요.'); return;
    }

    setSubmitting(true);
    try {
      await challengeService.joinChallenge({
        challenge_id: challenge.id,
        user_id: userId,
        category: selectedType.name,
        sub_type: selectedSubType || null,
        target_value: value,
        unit: selectedType.unit,
      });
      onJoined();
    } catch (e) {
      setError('참여 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>참여하기</h2>
            <p className="modal-subtitle">{challenge.title}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
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

          {/* 서브타입 선택 */}
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
              <label>
                목표 누적량 ({selectedType.unit})
              </label>
              <div className="input-with-unit">
                <input
                  type="number"
                  className="form-input"
                  placeholder={`예: ${selectedType.unit === 'km' ? '30' : '150'}`}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  min="0"
                  step={selectedType.unit === 'km' ? '0.1' : '1'}
                />
                <span className="input-unit">{selectedType.unit}</span>
              </div>
              <p className="form-hint">
                {challenge.start_date} ~ {challenge.end_date} 기간 내 누적 합산
              </p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting || !selectedType}>
            {submitting ? '등록 중...' : '선언하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
