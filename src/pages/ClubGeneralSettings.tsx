import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { ChevronLeft, Copy, Lock } from 'lucide-react';
import clubService from '../services/clubService';
import { useAuth } from '../contexts/AuthContext';
import { uploadToR2 } from '../utils/r2Storage';

export const ClubGeneralSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const { user } = useAuth();
  const navigate = useNavigate();

  // 부매니저도 이 화면에 들어오지만, 클럽 이름 변경은 방장만 가능
  const [isOwner, setIsOwner] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId) {
      loadClub();
    }
  }, [clubId, user]);

  const loadClub = async () => {
    if (!clubId) return;

    setLoading(true);
    try {
      const club = await clubService.getClubById(clubId);
      setIsOwner(!!user && club.created_by === user.id);
      setName(club.name);
      setDescription(club.description || '');
      setInviteCode(club.invite_code);
      setLogoPreview(club.logo_url || null);
    } catch (error) {
      console.error('클럽 정보 불러오기 실패:', error);
      alert('클럽 정보를 불러올 수 없습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyInviteCode = () => {
    const inviteUrl = `${window.location.origin}/join/${inviteCode}`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        alert('클럽 초대링크가 복사되었습니다! 📋\n카톡이나 메시지에 붙여넣어서 공유해보세요.');
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('클럽 초대링크가 복사되었습니다! 📋\n카톡이나 메시지에 붙여넣어서 공유해보세요.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clubId) return;

    if (isOwner && !name.trim()) {
      alert('클럽 이름을 입력해주세요.');
      return;
    }

    setUpdating(true);

    try {
      let logoUrl = logoPreview;

      if (logoFile) {
        try {
          logoUrl = await uploadToR2(logoFile);
        } catch (uploadError) {
          console.error('로고 업로드 실패:', uploadError);
          alert('로고 업로드에 실패했습니다. 로고 없이 저장하시겠습니까?');
        }
      }

      await clubService.updateClub(clubId, {
        // 방장이 아니면 이름은 payload에서 아예 제외 (input disabled만으로는 막을 수 없음)
        ...(isOwner ? { name: name.trim() } : {}),
        description: description.trim(),
        logo_url: logoUrl || undefined,
      });

      alert('클럽 정보가 수정되었습니다.');
      navigate(-1);
    } catch (error) {
      console.error('클럽 수정 실패:', error);
      alert('클럽 수정에 실패했습니다.');
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
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>일반정보 변경</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-group">
          <label htmlFor="name">
            클럽 이름 {isOwner ? '*' : <Lock size={13} style={{ verticalAlign: '-2px' }} />}
          </label>
          <input
            id="name"
            type="text"
            placeholder="예: 아침러닝클럽"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="value-input"
            required={isOwner}
            disabled={!isOwner}
            maxLength={30}
          />
          {!isOwner && <p className="form-hint">클럽 이름은 클럽장만 변경할 수 있습니다.</p>}
        </div>

        <div className="form-group">
          <label htmlFor="logo">클럽 로고</label>
          <input
            id="logo"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="file-input"
          />
          {logoPreview && (
            <div className="logo-preview">
              <img src={logoPreview} alt="클럽 로고" />
            </div>
          )}
          <p className="form-hint">클럽을 대표하는 로고 이미지를 업로드하세요. (선택)</p>
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
          <div className="invite-code-display">
            <div className="invite-code-value">{inviteCode}</div>
            <button type="button" className="copy-button" onClick={copyInviteCode}>
              <Copy size={16} />
            </button>
          </div>
          <p className="form-hint">초대 코드는 변경할 수 없습니다.</p>
        </div>

        <div className="form-group">
          <span style={{ fontSize: '15px', fontWeight: '600' }}>
            📊 운동일수 산입 설정
          </span>
          <p className="form-hint">
            운동일수 산입 여부는 이제 <strong>카테고리별</strong>로 설정합니다.<br />
            <strong>마일리지 계수 설정</strong> 화면의 각 종목 아래 "운동일수 산입" 체크박스에서 조정하세요.
          </p>
        </div>

        <button type="submit" className="primary-button-full" disabled={updating}>
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </form>
    </div>
  );
};
