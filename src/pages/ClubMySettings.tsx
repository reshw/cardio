import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';

export const ClubMySettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState('');
  const [clubName, setClubName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId && user) {
      loadNickname();
    }
  }, [clubId, user]);

  const loadNickname = async () => {
    if (!clubId || !user) return;

    setLoading(true);
    try {
      const currentNickname = await clubService.getClubNickname(clubId, user.id);
      setNickname(currentNickname || '');

      // 클럽 이름도 조회
      const club = await clubService.getClubById(clubId);
      setClubName(club.name);
    } catch (error) {
      console.error('닉네임 불러오기 실패:', error);
      alert('닉네임을 불러올 수 없습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clubId || !user || !nickname.trim()) {
      alert('별명을 입력해주세요.');
      return;
    }

    setUpdating(true);

    try {
      await clubService.updateClubNickname(clubId, user.id, nickname.trim());
      alert('별명이 변경되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('별명 변경 실패:', error);
      alert('별명 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>내 클럽 설정</h1>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group">
          <label htmlFor="nickname">클럽 별명 *</label>
          <input
            id="nickname"
            type="text"
            placeholder="예: 아침러너"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="value-input"
            required
            maxLength={20}
          />
          <p className="form-hint">
            {clubName} 클럽에서 표시될 이름입니다.
          </p>
        </div>

        <button type="submit" className="primary-button-full" disabled={updating}>
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </form>
    </div>
  );
};
