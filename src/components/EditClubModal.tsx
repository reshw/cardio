import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import type { MyClubWithOrder } from '../services/clubService';

interface Props {
  club: MyClubWithOrder;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditClubModal = ({ club, onClose, onSuccess }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description || '');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !name.trim()) {
      alert('클럽 이름을 입력해주세요.');
      return;
    }

    setUpdating(true);

    try {
      await clubService.updateClub(club.id, {
        name: name.trim(),
        description: description.trim(),
      });

      alert('클럽 정보가 수정되었습니다.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('클럽 수정 실패:', error);
      alert('클럽 수정에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`정말로 "${club.name}" 클럽을 삭제하시겠습니까?\n모든 멤버와 데이터가 삭제됩니다.`)) {
      return;
    }

    if (!confirm('삭제된 클럽은 복구할 수 없습니다. 정말 삭제하시겠습니까?')) {
      return;
    }

    setDeleting(true);

    try {
      await clubService.deleteClub(club.id);
      alert('클럽이 삭제되었습니다.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('클럽 삭제 실패:', error);
      alert('클럽 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>클럽 설정</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleUpdate}>
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

            <div className="form-group">
              <label>초대 코드</label>
              <div className="invite-code-readonly">
                {club.invite_code}
              </div>
              <p className="form-hint">초대 코드는 변경할 수 없습니다.</p>
            </div>

            <div className="modal-actions">
              <button type="button" className="cancel-button" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="primary-button" disabled={updating}>
                {updating ? '수정 중...' : '수정하기'}
              </button>
            </div>
          </form>

          <div className="danger-zone">
            <h3>위험 구역</h3>
            <p>클럽을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.</p>
            <button
              className="delete-button-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '삭제 중...' : '클럽 삭제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
