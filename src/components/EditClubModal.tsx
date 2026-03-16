import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import { uploadToCloudinary } from '../utils/cloudinary';
import type { MyClubWithOrder, MileageConfig } from '../services/clubService';

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(club.logo_url || null);

  const defaultConfig = clubService.getDefaultMileageConfig();
  const [mileageConfig, setMileageConfig] = useState<MileageConfig>(
    club.mileage_config || defaultConfig
  );

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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !name.trim()) {
      alert('클럽 이름을 입력해주세요.');
      return;
    }

    setUpdating(true);

    try {
      let logoUrl = club.logo_url;

      // 새 로고 파일이 있으면 업로드
      if (logoFile) {
        try {
          logoUrl = await uploadToCloudinary(logoFile);
        } catch (uploadError) {
          console.error('로고 업로드 실패:', uploadError);
          alert('로고 업로드에 실패했습니다. 로고 없이 저장하시겠습니까?');
        }
      }

      await clubService.updateClub(club.id, {
        name: name.trim(),
        description: description.trim(),
        mileage_config: mileageConfig,
        logo_url: logoUrl,
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

  const handleMileageChange = (key: keyof MileageConfig, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setMileageConfig({
        ...mileageConfig,
        [key]: numValue,
      });
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
              <div className="invite-code-readonly">
                {club.invite_code}
              </div>
              <p className="form-hint">초대 코드는 변경할 수 없습니다.</p>
            </div>

            <div className="form-group">
              <label>마일리지 계수 설정</label>
              <p className="form-hint">
                각 운동별 마일리지 계산 계수입니다. (예: 0.33은 거리의 33%)
              </p>
              <div className="mileage-config-grid">
                <div className="mileage-config-item">
                  <label>달리기 - 트레드밀</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={mileageConfig['달리기-트레드밀']}
                    onChange={(e) => handleMileageChange('달리기-트레드밀', e.target.value)}
                    className="mileage-input"
                  />
                </div>
                <div className="mileage-config-item">
                  <label>달리기 - 러닝</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={mileageConfig['달리기-러닝']}
                    onChange={(e) => handleMileageChange('달리기-러닝', e.target.value)}
                    className="mileage-input"
                  />
                </div>
                <div className="mileage-config-item">
                  <label>사이클 - 실외</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={mileageConfig['사이클-실외']}
                    onChange={(e) => handleMileageChange('사이클-실외', e.target.value)}
                    className="mileage-input"
                  />
                </div>
                <div className="mileage-config-item">
                  <label>사이클 - 실내</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={mileageConfig['사이클-실내']}
                    onChange={(e) => handleMileageChange('사이클-실내', e.target.value)}
                    className="mileage-input"
                  />
                </div>
                <div className="mileage-config-item">
                  <label>수영</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={mileageConfig['수영']}
                    onChange={(e) => handleMileageChange('수영', e.target.value)}
                    className="mileage-input"
                  />
                </div>
                <div className="mileage-config-item">
                  <label>계단</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={mileageConfig['계단']}
                    onChange={(e) => handleMileageChange('계단', e.target.value)}
                    className="mileage-input"
                  />
                </div>
              </div>
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
