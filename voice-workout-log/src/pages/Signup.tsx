import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

export const Signup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithKakao } = useAuth();

  const kakaoUserInfo = location.state?.kakaoUserInfo;
  const fromPath = location.state?.from || '/';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthYear: '',
    gender: '',
    nickname: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToSensitiveInfo, setAgreedToSensitiveInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 카카오 로그인이 아니면 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!kakaoUserInfo) {
      alert('카카오 로그인을 통해 회원가입을 진행해주세요.');
      navigate('/login', { replace: true });
    }
  }, [kakaoUserInfo, navigate]);

  // 카카오 로그인이면 폼 자동 입력
  useEffect(() => {
    if (kakaoUserInfo) {
      setFormData({
        name: kakaoUserInfo.displayName || '',
        email: kakaoUserInfo.email || '',
        phone: kakaoUserInfo.phoneNumber || '',
        birthYear: kakaoUserInfo.birthyear || '',
        gender: kakaoUserInfo.gender || '',
        nickname: kakaoUserInfo.nickname || '',
      });
    }
  }, [kakaoUserInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreedToTerms || !agreedToPrivacy || !agreedToSensitiveInfo) {
      setError('필수 약관에 모두 동의해주세요.');
      return;
    }

    // 필수 정보 확인
    if (!formData.name || !formData.phone || !formData.birthYear || !formData.gender) {
      setError('모든 필수 정보를 입력해주세요.');
      return;
    }

    // 카카오 회원가입
    if (kakaoUserInfo) {
      setLoading(true);
      try {
        // 입력받은 정보로 kakaoUserInfo 업데이트
        const updatedKakaoInfo = {
          ...kakaoUserInfo,
          displayName: formData.name,
          phoneNumber: formData.phone,
          birthyear: formData.birthYear,
          gender: formData.gender,
          email: formData.email,
          nickname: formData.nickname,
        };

        const userData = await authService.registerKakaoUser(updatedKakaoInfo);
        await loginWithKakao(userData);
        alert('회원가입이 완료되었습니다!');
        navigate(fromPath, { replace: true });
      } catch (err) {
        console.error('회원가입 실패:', err);
        setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.');
      } finally {
        setLoading(false);
      }
      return;
    }
  };

  // 카카오 로그인이 없으면 null 반환 (리다이렉트 처리됨)
  if (!kakaoUserInfo) {
    return null;
  }

  return (
    <div className="container">
      <div className="signup-container">
        <h1>회원가입</h1>
        <p className="signup-subtitle">카카오 계정 정보를 확인해주세요</p>

        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="form-group">
            <label htmlFor="kakaoId">카카오 계정</label>
            <input
              id="kakaoId"
              type="text"
              value={`카카오 ID: ${kakaoUserInfo.id}`}
              readOnly
              disabled
              style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <p className="field-hint">카카오 로그인으로 승인된 계정입니다</p>
          </div>

          {formData.nickname && (
            <div className="form-group">
              <label htmlFor="nickname">닉네임</label>
              <input
                id="nickname"
                type="text"
                value={formData.nickname}
                readOnly
                disabled
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </div>
          )}

          {kakaoUserInfo.profileImage && (
            <div className="form-group">
              <label>프로필 사진</label>
              <img
                src={kakaoUserInfo.profileImage}
                alt="프로필"
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">이름 *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="실명을 입력해주세요"
              required
              readOnly={!!kakaoUserInfo?.displayName}
              disabled={!!kakaoUserInfo?.displayName}
              style={kakaoUserInfo?.displayName ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
            />
            {kakaoUserInfo?.displayName && (
              <p className="field-hint">카카오에서 제공된 정보입니다</p>
            )}
          </div>

          {formData.email && (
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                readOnly
                disabled
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
              <p className="field-hint">카카오에서 제공된 정보입니다</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="phone">전화번호 *</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="010-1234-5678"
              required
              readOnly={!!kakaoUserInfo?.phoneNumber}
              disabled={!!kakaoUserInfo?.phoneNumber}
              style={kakaoUserInfo?.phoneNumber ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
            />
            {kakaoUserInfo?.phoneNumber ? (
              <p className="field-hint">카카오에서 제공된 정보입니다</p>
            ) : (
              <p className="field-hint">전화번호를 입력해주세요</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="birthYear">출생연도 *</label>
            <input
              id="birthYear"
              type="number"
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
              placeholder="1990"
              min="1900"
              max={new Date().getFullYear()}
              required
              readOnly={!!kakaoUserInfo?.birthyear}
              disabled={!!kakaoUserInfo?.birthyear}
              style={kakaoUserInfo?.birthyear ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
            />
            {kakaoUserInfo?.birthyear ? (
              <p className="field-hint">카카오에서 제공된 정보입니다</p>
            ) : (
              <p className="field-hint">나이대별 맞춤 운동 추천에 활용됩니다</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="gender">성별 *</label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              required
              disabled={!!kakaoUserInfo?.gender}
              style={kakaoUserInfo?.gender ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
            >
              <option value="">선택해주세요</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
            {kakaoUserInfo?.gender && (
              <p className="field-hint">카카오에서 제공된 정보입니다</p>
            )}
          </div>

          <div className="agreements-section">
            <div className="agreement-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                />
                <span>
                  <Link to="/terms" target="_blank" className="link-text">
                    이용약관
                  </Link>
                  에 동의합니다 (필수)
                </span>
              </label>
            </div>

            <div className="agreement-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  required
                />
                <span>
                  <Link to="/privacy" target="_blank" className="link-text">
                    개인정보처리방침
                  </Link>
                  에 동의합니다 (필수)
                </span>
              </label>
            </div>

            <div className="agreement-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToSensitiveInfo}
                  onChange={(e) => setAgreedToSensitiveInfo(e.target.checked)}
                  required
                />
                <span>
                  민감정보(건강정보) 수집 및 이용에 동의합니다 (필수)
                </span>
              </label>
            </div>
            <p className="field-hint" style={{ marginTop: '12px', textAlign: 'left' }}>
              운동 기록, 신체 활동 정보 등 건강 관련 민감정보가 수집됩니다.
            </p>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={!agreedToTerms || !agreedToPrivacy || !agreedToSensitiveInfo || loading}
          >
            {loading ? '회원가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="signup-footer">
          <p>
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="link-text">
              로그인
            </Link>
          </p>
        </div>

        <div className="login-business-info">
          <p>jh308(제이에이치308) | 대표자: 양석환 | 사업자번호: 188-17-02548</p>
        </div>
      </div>
    </div>
  );
};
