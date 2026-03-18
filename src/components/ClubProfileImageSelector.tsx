import { useState } from 'react';
import { Upload, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onSelect: (imageUrl: string | File | null) => void;
  initialValue?: string | File | null;
  nickname?: string;
}

// 기본 색상 팔레트 (첫 번째는 그라데이션)
const DEFAULT_COLORS = [
  'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)', // gradient
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
];

export const ClubProfileImageSelector = ({ onSelect, initialValue, nickname }: Props) => {
  const { user } = useAuth();

  // 초기값 파싱
  const parseInitialValue = () => {
    if (!initialValue) {
      return {
        option: 'default' as const,
        color: DEFAULT_COLORS[0],
        uploadedImage: null,
        uploadedFile: null,
      };
    }

    if (typeof initialValue === 'string') {
      if (initialValue.startsWith('default:')) {
        const color = initialValue.replace('default:', '');
        return {
          option: 'default' as const,
          color: DEFAULT_COLORS.includes(color) ? color : DEFAULT_COLORS[0],
          uploadedImage: null,
          uploadedFile: null,
        };
      } else if (initialValue === user?.profile_image) {
        return {
          option: 'kakao' as const,
          color: DEFAULT_COLORS[0],
          uploadedImage: null,
          uploadedFile: null,
        };
      } else {
        // URL 형식 (업로드된 이미지)
        return {
          option: 'upload' as const,
          color: DEFAULT_COLORS[0],
          uploadedImage: initialValue,
          uploadedFile: null,
        };
      }
    } else {
      // File 객체
      return {
        option: 'upload' as const,
        color: DEFAULT_COLORS[0],
        uploadedImage: null,
        uploadedFile: initialValue,
      };
    }
  };

  const initial = parseInitialValue();
  const [selectedOption, setSelectedOption] = useState<'default' | 'upload' | 'kakao'>(initial.option);
  const [selectedColor, setSelectedColor] = useState(initial.color);
  const [uploadedImage, setUploadedImage] = useState<string | null>(initial.uploadedImage);
  const [uploadedFile, setUploadedFile] = useState<File | null>(initial.uploadedFile);

  const handleOptionChange = (option: 'default' | 'upload' | 'kakao') => {
    setSelectedOption(option);

    if (option === 'default') {
      onSelect(`default:${selectedColor}`);
    } else if (option === 'kakao' && user?.profile_image) {
      onSelect(user.profile_image);
    } else if (option === 'upload' && uploadedImage) {
      onSelect(uploadedFile); // File 객체 전달
    } else {
      onSelect(null);
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    onSelect(`default:${color}`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        onSelect(file); // File 객체 전달
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = () => {
    // 별명이 있으면 별명의 첫 글자, 없으면 본명의 첫 글자
    const name = nickname?.trim() || user?.display_name;
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="profile-image-selector">
      {/* 옵션 1: 기본 아바타 */}
      <div className={`selector-card ${selectedOption === 'default' ? 'active' : ''}`}>
        <div className="card-header" onClick={() => handleOptionChange('default')}>
          <div className="radio-wrapper">
            <input
              type="radio"
              name="profile-option"
              checked={selectedOption === 'default'}
              onChange={() => handleOptionChange('default')}
            />
            <span className="card-title">기본 아바타</span>
          </div>
          {selectedOption === 'default' && (
            <div className="preview-mini" style={{ background: selectedColor }}>
              {getInitials()}
            </div>
          )}
        </div>

        {selectedOption === 'default' && (
          <div className="card-body">
            <div className="preview-large" style={{ background: selectedColor }}>
              {getInitials()}
            </div>
            <div className="color-palette">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                  aria-label={`색상 ${color}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 옵션 2: 사진 업로드 */}
      <div className={`selector-card ${selectedOption === 'upload' ? 'active' : ''}`}>
        <div className="card-header" onClick={() => handleOptionChange('upload')}>
          <div className="radio-wrapper">
            <input
              type="radio"
              name="profile-option"
              checked={selectedOption === 'upload'}
              onChange={() => handleOptionChange('upload')}
            />
            <span className="card-title">사진 업로드</span>
          </div>
          {selectedOption === 'upload' && uploadedImage && (
            <div className="preview-mini">
              <img src={uploadedImage} alt="업로드된 프로필" />
            </div>
          )}
        </div>

        {selectedOption === 'upload' && (
          <div className="card-body">
            {uploadedImage ? (
              <div className="preview-large">
                <img src={uploadedImage} alt="업로드된 프로필" />
              </div>
            ) : (
              <div className="upload-placeholder">
                <User size={48} strokeWidth={1.5} />
                <p>사진을 선택해주세요</p>
              </div>
            )}
            <label htmlFor="profile-upload" className="upload-btn">
              <Upload size={18} />
              {uploadedImage ? '다른 사진 선택' : '사진 선택하기'}
            </label>
            <input
              id="profile-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      {/* 옵션 3: 카카오 프로필 사용 */}
      <div
        className={`selector-card ${selectedOption === 'kakao' ? 'active' : ''} ${!user?.profile_image ? 'disabled' : ''}`}
      >
        <div
          className="card-header"
          onClick={() => user?.profile_image && handleOptionChange('kakao')}
        >
          <div className="radio-wrapper">
            <input
              type="radio"
              name="profile-option"
              checked={selectedOption === 'kakao'}
              onChange={() => handleOptionChange('kakao')}
              disabled={!user?.profile_image}
            />
            <span className="card-title">
              카카오 프로필
              {!user?.profile_image && <span className="card-subtitle">사용 불가</span>}
            </span>
          </div>
          {selectedOption === 'kakao' && user?.profile_image && (
            <div className="preview-mini">
              <img src={user.profile_image} alt="카카오 프로필" />
            </div>
          )}
        </div>

        {selectedOption === 'kakao' && user?.profile_image && (
          <div className="card-body">
            <div className="preview-large">
              <img src={user.profile_image} alt="카카오 프로필" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
