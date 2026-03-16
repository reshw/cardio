import KakaoLogin from '../components/KakaoLogin';

export const Login = () => {
  return (
    <div className="container">
      <div className="login-container">
        <h1>💪 Cardio</h1>
        <p className="login-subtitle">운동과 함께하는 건강한 삶</p>

        <KakaoLogin />

        <div className="login-business-info">
          <p>jh308(제이에이치308) | 대표자: 양석환 | 사업자번호: 188-17-02548</p>
        </div>
      </div>
    </div>
  );
};
