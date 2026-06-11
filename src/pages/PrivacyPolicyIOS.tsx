export const PrivacyPolicyIOS = () => {
  return (
    <div className="container">
      <div className="policy-container">
        <h1>개인정보처리방침</h1>
        <p className="policy-date">적용 대상: CardioXclub (iOS 앱)</p>
        <p className="policy-date">시행일자: 2026년 1월 15일</p>

        <section className="policy-section">
          <h2>1. 개인정보의 수집 및 이용 목적</h2>
          <p>
            jh308(제이에이치308)(이하 "회사")는 CardioXclub iOS 앱(이하 "앱")을 통해
            수집한 개인정보를 다음의 목적으로 처리합니다.
          </p>
          <ul>
            <li>회원 식별 및 서비스 제공: 로그인, 계정 관리, 본인 인증</li>
            <li>운동 랭킹 서비스: Apple Health 데이터를 기반으로 회원 간 운동 기록을 집계하여 랭킹 제공</li>
            <li>서비스 개선: 통계 분석 및 기능 향상</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>2. 수집하는 개인정보 항목</h2>

          <h3>로그인 정보 (신원에 연결됨)</h3>
          <ul>
            <li>
              카카오 로그인: 이름, 이메일 주소
            </li>
            <li>
              Apple 로그인 (Sign in with Apple): 이름, 이메일 주소
              (Apple이 제공하는 익명 릴레이 이메일 포함)
            </li>
          </ul>

          <h3>Apple Health 데이터 (신원에 연결됨)</h3>
          <p>
            앱은 사용자의 명시적 허가 하에 Apple HealthKit에서 다음 데이터를 읽습니다.
            수집된 데이터는 랭킹 산정을 위해 회사 서버에 전송·저장됩니다.
          </p>
          <ul>
            <li>운동 기록 (운동 종류, 시간, 칼로리 등)</li>
            <li>피트니스 데이터 (걸음 수, 활동 에너지 등)</li>
            <li>기타 사용자가 허가한 건강 지표</li>
          </ul>
          <p>
            HealthKit에서 읽은 데이터는 랭킹 서비스 제공 외 다른 목적으로 사용되지 않으며,
            광고·마케팅 목적으로 제3자에게 판매하지 않습니다.
          </p>

          <h3>서비스 이용 정보</h3>
          <ul>
            <li>접속 로그, 기기 정보, 앱 이용 기록</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>3. 타 회원 데이터와의 결합</h2>
          <p>
            본 앱은 랭킹 서비스 특성상 수집된 운동 데이터를 다른 회원의 데이터와
            집계·비교하여 순위를 산출합니다. 이 과정에서 개별 회원의 데이터는
            해당 회원의 계정과 연결되어 서버에 저장됩니다.
            타 회원에게는 랭킹 순위 및 집계 결과만 표시되며,
            개인 식별 정보는 공개 설정에 따릅니다.
          </p>
        </section>

        <section className="policy-section">
          <h2>4. 개인정보의 보유 및 이용 기간</h2>
          <ul>
            <li>회원 정보 및 운동 기록: 회원 탈퇴 시까지</li>
            <li>탈퇴 후: 부정 이용 방지 목적으로 1년 보관 후 즉시 파기</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>5. 개인정보의 제3자 제공 및 처리 위탁</h2>
          <p>회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.</p>
          <p>다음 업체에 서비스 운영을 위해 처리를 위탁합니다.</p>
          <ul>
            <li>Supabase: 회원 정보 및 운동 데이터 저장·관리</li>
            <li>카카오(Kakao Corp.): 소셜 로그인 인증</li>
            <li>Apple Inc.: Sign in with Apple 인증</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>6. 추적(Tracking) 관련</h2>
          <p>
            본 앱은 다른 회사의 앱 또는 웹사이트에 걸쳐 사용자를 추적하지 않습니다.
            수집된 데이터는 CardioXclub 서비스 제공 목적으로만 사용됩니다.
          </p>
        </section>

        <section className="policy-section">
          <h2>7. 연령 제한</h2>
          <p>
            본 앱은 만 13세 이상 사용자를 대상으로 합니다.
            만 13세 미만 아동의 개인정보는 수집하지 않으며,
            해당 연령 미만으로 확인된 경우 계정을 즉시 삭제합니다.
          </p>
        </section>

        <section className="policy-section">
          <h2>8. 정보주체의 권리</h2>
          <ul>
            <li>앱 설정에서 Apple Health 데이터 접근 권한을 언제든지 철회할 수 있습니다</li>
            <li>앱 내 설정 메뉴를 통해 계정 탈퇴 및 데이터 삭제를 요청할 수 있습니다</li>
            <li>개인정보 열람, 정정, 삭제, 처리정지 요구 가능</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>9. 개인정보 보호책임자</h2>
          <div className="contact-info">
            <p><strong>개인정보 보호책임자</strong></p>
            <p>성명: 양석환</p>
            <p>이메일: shy@lunagarden.co.kr</p>
            <p>전화: 010-3114-8626</p>
          </div>
        </section>

        <section className="policy-section">
          <h2>10. 개인정보 처리방침의 변경</h2>
          <p>
            본 방침은 시행일로부터 적용되며, 변경 시 시행 7일 전 앱 내 공지를 통해 고지합니다.
          </p>
        </section>
      </div>
    </div>
  );
};
