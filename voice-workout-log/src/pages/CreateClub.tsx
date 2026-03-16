import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clubService from '../services/clubService';

export const CreateClubPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('클럽명을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const club = await clubService.createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      });
      alert('클럽이 생성되었습니다!');
      navigate(`/club/${club.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '클럽 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate('/club')}>
          ← 뒤로
        </button>
        <h2>클럽 만들기</h2>
      </div>

      <div className="section">
        <h3>클럽 정보</h3>
        <div className="form-group">
          <label>클럽명 *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 헬스장 친구들"
            maxLength={50}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          />
          <div className="field-hint">{name.length}/50자</div>
        </div>

        <div className="form-group">
          <label>설명</label>
          <textarea
            className="text-input-area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="클럽에 대한 간단한 설명을 입력하세요 (선택)"
            rows={4}
            maxLength={200}
          />
          <div className="field-hint">{description.length}/200자</div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>
              공개 클럽으로 만들기
              <div className="field-hint" style={{ marginTop: '4px' }}>
                공개 클럽은 누구나 검색하고 가입할 수 있습니다.
              </div>
            </span>
          </label>
        </div>
      </div>

      <div className="action-buttons">
        <button className="cancel-button" onClick={() => navigate('/club')}>
          취소
        </button>
        <button
          className="primary-button"
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
        >
          {loading ? '생성 중...' : '클럽 만들기'}
        </button>
      </div>
    </div>
  );
};
