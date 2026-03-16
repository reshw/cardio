import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateClubModal = ({ onClose, onSuccess }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !name.trim()) {
      alert('클럽 이름을 입력해주세요.');
      return;
    }

    setCreating(true);

    try {
      await clubService.createClub({
        name: name.trim(),
        description: description.trim(),
        created_by: user.id,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('클럽 생성 실패:', error);
      alert('클럽 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>클럽 만들기</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">클럽 이름 *</label>
              <input
                id="name"
                type="text"
                placeholder="예: 아침러닝클럽"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="value-input"
                required
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">클럽 소개</label>
              <textarea
                id="description"
                placeholder="클럽을 소개해주세요"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea-input"
                rows={4}
                maxLength={200}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="cancel-button" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="primary-button" disabled={creating}>
                {creating ? '생성 중...' : '클럽 만들기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
