import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import challengeService from '../services/challengeService';
import type { MyClubWithOrder } from '../services/clubService';
import workoutTypeService from '../services/workoutTypeService';
import type { WorkoutType } from '../services/workoutTypeService';

interface Props {
  club: MyClubWithOrder;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

export const ChallengeCreateModal = ({ club, userId, onClose, onCreated }: Props) => {
  const today = new Date().toISOString().split('T')[0];
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [allAllowed, setAllAllowed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
          <h3>챌린지 만들기</h3>
          <button className="race-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="race-form">
          {/* 챌린지 이름 */}
          <div className="race-form-group">
            <label>챌린지 이름</label>
            <input
              className="race-input"
              placeholder="예: 5월 연휴 챌린지!"
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

          {/* 허용 종목 */}
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

          {error && <p className="challenge-create-error">{error}</p>}

          <button
            className="challenge-create-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '생성 중...' : '챌린지 열기'}
          </button>
        </div>
      </div>
    </div>
  );
};
