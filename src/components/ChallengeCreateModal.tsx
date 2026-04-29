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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>챌린지 만들기</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>챌린지 이름</label>
            <input
              className="form-input"
              placeholder="예: 26년 05월 연휴 챌린지!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
            />
          </div>

          <div className="form-group">
            <label>시작일</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>종료일</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>허용 종목</label>
            <div className="challenge-allowed-toggle">
              <button
                className={`workout-type-chip ${allAllowed ? 'selected' : ''}`}
                onClick={() => setAllAllowed(true)}
              >
                전체 허용
              </button>
              <button
                className={`workout-type-chip ${!allAllowed ? 'selected' : ''}`}
                onClick={() => setAllAllowed(false)}
              >
                종목 지정
              </button>
            </div>
            {!allAllowed && (
              <div className="workout-type-grid" style={{ marginTop: 10 }}>
                {workoutTypes.map((type) => (
                  <button
                    key={type.id}
                    className={`workout-type-chip ${selectedCategories.includes(type.name) ? 'selected' : ''}`}
                    onClick={() => toggleCategory(type.name)}
                  >
                    {type.emoji} {type.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '생성 중...' : '만들기'}
          </button>
        </div>
      </div>
    </div>
  );
};
