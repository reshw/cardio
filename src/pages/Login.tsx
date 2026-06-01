import KakaoLogin from '../components/KakaoLogin';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
  const { loginAsDemo } = useAuth();

  return (
    <div className="container">
      <div className="login-container">
        <h1>💪 Cardio</h1>
        <p className="login-subtitle">운동과 함께하는 건강한 삶</p>

        <KakaoLogin />

        <button className="demo-login-button" onClick={loginAsDemo}>
          데모 체험하기
        </button>
      </div>
    </div>
  );
};
