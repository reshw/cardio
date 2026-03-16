import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';

export const JoinClub = () => {
  const { code } = useParams<{ code?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState(code || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (code) {
      setInviteCode(code);
    }
  }, [code]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!inviteCode || inviteCode.length !== 6) {
      setError('6자리 초대 코드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const club = await clubService.joinClubByInviteCode(inviteCode, user.id);
      alert(`${club.name}에 가입했습니다! 🎉`);
      navigate('/club');
    } catch (err) {
      console.error('클럽 가입 실패:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('클럽 가입에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container join-container">
      <div className="join-card">
        <h1>🏃 클럽 가입</h1>
        <p className="join-subtitle">초대 코드를 입력하여 클럽에 가입하세요</p>

        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label htmlFor="inviteCode">초대 코드 (6자리)</label>
            <input
              id="inviteCode"
              type="text"
              placeholder="예: aB3xY9"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setError('');
              }}
              className="invite-code-input"
              maxLength={6}
              required
            />
            {error && <p className="error-message">{error}</p>}
          </div>

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? '가입 처리 중...' : '클럽 가입하기'}
          </button>

          <button
            type="button"
            className="cancel-button"
            onClick={() => navigate('/club')}
            style={{ marginTop: '12px' }}
          >
            취소
          </button>
        </form>

        <div className="join-help">
          <p>💡 클럽 초대 코드는 클럽 관리자에게 받을 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
};
