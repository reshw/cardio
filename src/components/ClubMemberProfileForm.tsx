import { ClubProfileImageSelector } from './ClubProfileImageSelector';

interface Props {
  nickname: string;
  profileImage: string | File | null;
  onNicknameChange: (nickname: string) => void;
  onProfileImageChange: (image: string | File | null) => void;
  nicknameLabel?: string;
  nicknameHint?: string;
  profileImageLabel?: string;
  profileImageHint?: string;
  required?: boolean;
}

export const ClubMemberProfileForm = ({
  nickname,
  profileImage,
  onNicknameChange,
  onProfileImageChange,
  nicknameLabel = '클럽에서 사용할 별명',
  nicknameHint = '클럽 멤버들에게 표시될 이름입니다. 나중에 변경할 수 있습니다.',
  profileImageLabel = '클럽 프로필 사진',
  profileImageHint = '이 클럽에서 사용할 프로필 사진을 선택하세요. 나중에 변경할 수 있습니다.',
  required = true,
}: Props) => {
  return (
    <div className="club-member-profile-form">
      {/* 별명 입력 */}
      <div className="form-group">
        <label htmlFor="club-nickname">
          {nicknameLabel} {required && '*'}
        </label>
        <input
          id="club-nickname"
          type="text"
          placeholder="예: 아침러너"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          className="value-input"
          maxLength={20}
          required={required}
        />
        {nicknameHint && <p className="form-hint">{nicknameHint}</p>}
      </div>

      {/* 프로필 사진 선택 */}
      <div className="form-group">
        <label>{profileImageLabel} (선택)</label>
        {profileImageHint && (
          <p className="form-hint" style={{ marginTop: 0, marginBottom: '12px' }}>
            {profileImageHint}
          </p>
        )}
        <ClubProfileImageSelector
          onSelect={onProfileImageChange}
          initialValue={profileImage}
          nickname={nickname}
        />
      </div>
    </div>
  );
};
