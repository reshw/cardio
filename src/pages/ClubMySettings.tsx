import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import { ClubMemberProfileForm } from '../components/ClubMemberProfileForm';
import { uploadToR2 } from '../utils/r2Storage';

export const ClubMySettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState('');
  const [profileImage, setProfileImage] = useState<string | File | null>(null);
  const [clubName, setClubName] = useState('');
  const [showInFeed, setShowInFeed] = useState(true);
  const [showMileage, setShowMileage] = useState(true);
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
      // 멤버 프로필 정보 조회 (별명, 프로필 이미지)
      const memberProfile = await clubService.getClubMemberProfile(clubId, user.id);
      setNickname(memberProfile.club_nickname || '');
      setProfileImage(memberProfile.club_profile_image || null);

      // 클럽 이름도 조회
      const club = await clubService.getClubById(clubId);
      setClubName(club.name);

      // 개인 설정 조회
      const settings = await clubService.getMemberSettings(clubId, user.id);
      setShowInFeed(settings.show_in_feed);
      setShowMileage(settings.show_mileage);
    } catch (error) {
      console.error('설정 불러오기 실패:', error);
      alert('설정을 불러올 수 없습니다.');
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
      // 프로필 이미지 처리
      let profileImageUrl: string | null = null;

      if (profileImage) {
        if (profileImage instanceof File) {
          // 새 파일 업로드
          profileImageUrl = await uploadToR2(profileImage);
        } else {
          // 기존 문자열 (default:color 또는 URL)
          profileImageUrl = profileImage;
        }
      }

      // 멤버 프로필 업데이트 (별명 + 프로필 이미지)
      await clubService.updateClubMemberProfile(clubId, user.id, {
        club_nickname: nickname.trim(),
        club_profile_image: profileImageUrl,
      });

      // 개인 설정 업데이트
      await clubService.updateMemberSettings(clubId, user.id, {
        show_in_feed: showInFeed,
        show_mileage: showMileage,
      });

      alert('설정이 저장되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert('설정 저장에 실패했습니다.');
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
        <ClubMemberProfileForm
          nickname={nickname}
          profileImage={profileImage}
          onNicknameChange={setNickname}
          onProfileImageChange={setProfileImage}
          nicknameLabel="클럽 별명"
          nicknameHint={`${clubName} 클럽에서 표시될 이름입니다.`}
          profileImageLabel="클럽 프로필 사진"
          profileImageHint={`${clubName} 클럽에서 사용할 프로필 사진입니다.`}
        />

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showInFeed}
              onChange={(e) => setShowInFeed(e.target.checked)}
            />
            <span>내 운동을 피드에 표시</span>
          </label>
          <p className="form-hint">체크 해제 시 클럽 피드에 내 운동이 표시되지 않습니다.</p>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showMileage}
              onChange={(e) => setShowMileage(e.target.checked)}
            />
            <span>내 마일리지를 랭킹에 포함</span>
          </label>
          <p className="form-hint">체크 해제 시 클럽 랭킹에서 제외됩니다.</p>
        </div>

        <button type="submit" className="primary-button-full" disabled={updating}>
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </form>
    </div>
  );
};
