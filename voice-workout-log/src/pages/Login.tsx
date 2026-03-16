import { Link } from 'react-router-dom';
import KakaoLogin from '../components/KakaoLogin';

export const Login = () => {
  return (
    <div className="container">
      <div className="login-container">
        <h1>🏋️ Voice Workout Log</h1>
        <p className="login-subtitle">운동 기록 앱</p>

        <KakaoLogin />

        <div className="login-footer">
          <p>
            계정이 없으신가요?{' '}
            <Link to="/signup" className="link-text">
              회원가입
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
