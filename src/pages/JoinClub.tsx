import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import type { Club } from '../services/clubService';
import { ClubMemberProfileForm } from '../components/ClubMemberProfileForm';
import { uploadToR2 } from '../utils/r2Storage';

export const JoinClub = () => {
  const { code } = useParams<{ code?: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState(code || '');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clubPreview, setClubPreview] = useState<{
    club: Club;
    ownerName: string;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [profileImage, setProfileImage] = useState<string | File | null>(null);

  // 비로그인 사용자 처리
  useEffect(() => {
    if (!authLoading && !user) {
      // 현재 경로를 저장하고 로그인 페이지로 리디렉트
      const currentPath = code ? `/join/${code}` : '/join';
      sessionStorage.setItem('redirect_after_login', currentPath);
      navigate('/');
    }
  }, [user, authLoading, code, navigate]);

  // URL에 코드가 있으면 자동으로 클럽 미리보기 조회
  useEffect(() => {
    if (code && user) {
      loadClubPreview(code);
    }
  }, [code, user]);

  const loadClubPreview = async (inviteCode: string) => {
    setLoadingPreview(true);
    setError('');
    try {
      const preview = await clubService.getClubPreviewByInviteCode(inviteCode);
      if (!preview) {
        setError('존재하지 않거나 승인되지 않은 초대 코드입니다.');
        return;
      }

      // 이미 가입한 클럽인지 확인
      if (user) {
        const isMember = await clubService.isClubMember(preview.club.id, user.id);
        if (isMember) {
          // 이미 가입한 클럽이면 바로 클럽 메인으로 리디렉트
          navigate('/club');
          return;
        }
      }

      setClubPreview(preview);
    } catch (err) {
      console.error('클럽 미리보기 조회 실패:', err);
      setError('클럽 정보를 불러올 수 없습니다.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode || inviteCode.length !== 6) {
      setError('6자리 초대 코드를 입력해주세요.');
      return;
    }

    await loadClubPreview(inviteCode);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!nickname.trim()) {
      setError('클럽에서 사용할 별명을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const finalCode = code || inviteCode;

      // 프로필 이미지 처리
      let profileImageUrl: string | undefined = undefined;

      if (profileImage) {
        if (profileImage instanceof File) {
          // 파일 업로드
          profileImageUrl = await uploadToR2(profileImage);
        } else {
          // 문자열 (default:color 또는 카카오 프로필 URL)
          profileImageUrl = profileImage;
        }
      }

      const club = await clubService.joinClubByInviteCode(finalCode, user.id, nickname.trim(), profileImageUrl);
      alert(`${club.name}에 가입했습니다! 🎉`);
      const returnUrl = sessionStorage.getItem('join_return_url');
      if (returnUrl) {
        sessionStorage.removeItem('join_return_url');
        navigate(returnUrl);
      } else {
        navigate('/club');
      }
    } catch (err) {
      console.error('클럽 가입 실패:', err);

      // 이미 가입한 클럽인 경우 조용히 returnUrl 또는 메인으로 리다이렉트
      if (err instanceof Error && err.message === '이미 가입한 클럽입니다.') {
        const returnUrl = sessionStorage.getItem('join_return_url');
        if (returnUrl) {
          sessionStorage.removeItem('join_return_url');
          navigate(returnUrl);
        } else {
          navigate('/club');
        }
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('클럽 가입에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (loadingPreview) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>클럽 정보 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container join-container">
      <div className="join-card">
        <h1>🏃 클럽 가입</h1>

        {/* URL에 코드가 없거나 클럽 미리보기가 없는 경우: 코드 입력 */}
        {!code && !clubPreview && (
          <>
            <p className="join-subtitle">초대 코드를 입력하여 클럽에 가입하세요</p>
            <form onSubmit={handleVerifyCode}>
              <div className="form-group">
                <label htmlFor="inviteCode">초대 코드 (6자리)</label>
                <input
                  id="inviteCode"
                  type="text"
                  placeholder="예: aB3xY9"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  className="invite-code-input"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>

              {error && <p className="error-message">{error}</p>}

              <button type="submit" className="primary-button">
                코드 확인
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
          </>
        )}

        {/* 클럽 미리보기가 있는 경우: 클럽 정보 + 별명 입력 */}
        {clubPreview && (
          <>
            <div className="club-preview-card">
              <div className="club-preview-info">
                <h2>{clubPreview.club.name}</h2>
                <p className="club-preview-owner">
                  클럽장: <strong>{clubPreview.ownerName}</strong>
                </p>
                {clubPreview.club.description && (
                  <p className="club-preview-description">{clubPreview.club.description}</p>
                )}
              </div>
            </div>

            <form onSubmit={handleJoin}>
              <ClubMemberProfileForm
                nickname={nickname}
                profileImage={profileImage}
                onNicknameChange={(value) => {
                  setNickname(value);
                  setError('');
                }}
                onProfileImageChange={setProfileImage}
              />

              {error && <p className="error-message">{error}</p>}

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
          </>
        )}

        <div className="join-help">
          <p>💡 클럽 초대 코드는 클럽 관리자에게 받을 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
};
