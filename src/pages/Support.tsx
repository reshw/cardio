import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SUPPORT_EMAIL = 'shy@lunagarden.co.kr';

/**
 * 고객 지원 페이지 (public 라우트 /support).
 *
 * App Store Connect 의 "지원 URL" 로 쓰인다 — Guideline 1.5 (Developer Information) 대응.
 * 심사자는 비로그인 상태로 접근하므로 ProtectedRoutes 안에 두면 로그인 화면이 떠서
 * "not functional" 로 반려된다. App.tsx 의 public 라우트에 반드시 남아 있어야 한다.
 */
export const Support = () => {
  const navigate = useNavigate();

  // App Store 지원 URL 로 직접 열린 경우엔 돌아갈 히스토리가 없다.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="container">
      <div className="policy-container">
        <div className="policy-topbar">
          <button className="policy-back-btn" onClick={goBack}>
            <ArrowLeft size={18} />
            <span>돌아가기</span>
          </button>
        </div>

        <h1>고객 지원</h1>
        <p className="policy-date">CardioXclub (iOS 앱 · Android 앱 · 웹 서비스)</p>
        <p className="policy-date">운영: jh308(제이에이치308)</p>

        <section className="policy-section">
          <h2>문의하기</h2>
          <p>
            서비스 이용 중 문제가 있거나 문의사항이 있으시면 아래 이메일로 연락해 주세요.
            영업일 기준 2일 이내에 답변드립니다.
          </p>
          <div className="contact-info">
            <p><strong>이메일 문의</strong></p>
            <p>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
            <p>운영 주체: jh308(제이에이치308)</p>
            <p>담당: 양석환</p>
          </div>
          <p>
            문의하실 때 <strong>가입에 사용한 이메일 주소</strong>와{' '}
            <strong>사용 중인 기기·앱 버전</strong>을 함께 알려주시면 더 빠르게 확인할 수 있습니다.
          </p>
        </section>

        <section className="policy-section">
          <h2>자주 묻는 질문</h2>

          <h3>카카오 로그인이 안 됩니다</h3>
          <p>
            카카오톡 인앱 브라우저에서는 보안 정책상 카카오 로그인이 실패할 수 있습니다.
            Safari 또는 Chrome 등 일반 브라우저로 다시 접속해 주세요.
          </p>
          <ul>
            <li>iOS: 오른쪽 위 ⋮ 메뉴 → "다른 브라우저로 열기" → Safari 선택</li>
            <li>Android: 로그인 화면의 "외부 브라우저로 열기" 버튼을 누르면 자동으로 이동합니다</li>
          </ul>
          <p>
            그래도 해결되지 않으면 로그인 화면 아래의 "로그인이 계속 안 되시나요?" 를 눌러
            진단 정보를 보내주시거나, 위 이메일로 문의해 주세요.
          </p>

          <h3>Apple Health(건강 앱) 데이터가 동기화되지 않습니다</h3>
          <p>
            앱은 사용자가 허용한 항목만 읽어올 수 있습니다. 아래를 확인해 주세요.
          </p>
          <ul>
            <li>
              iOS 설정 앱 → 건강 → 데이터 접근 및 기기 → CardioXclub 에서
              운동·걸음 수 항목이 켜져 있는지 확인
            </li>
            <li>앱 안에서 더보기 → "건강 데이터 동기화 관리" 로 권한 상태를 다시 확인</li>
            <li>권한을 껐다가 다시 켠 경우, 앱을 완전히 종료 후 재실행</li>
          </ul>
          <p>
            Android 는 Apple Health 대신 Health Connect 를 사용하며, 동일하게 앱별 권한 설정이
            켜져 있어야 합니다.
          </p>

          <h3>Strava 연동이 끊깁니다</h3>
          <p>
            더보기 → 외부 연동에서 Strava 연동 상태를 확인할 수 있습니다.
            연동이 해제된 경우 "연동" 버튼으로 다시 연결해 주세요.
          </p>

          <h3>다크 모드를 켜고 싶습니다</h3>
          <p>더보기 → 앱 설정 → 다크 모드 를 켜면 됩니다.</p>

          <h3>운동 기록이 랭킹에 반영되지 않습니다</h3>
          <p>
            랭킹 집계 기준은 클럽마다 다르게 설정될 수 있습니다.
            소속 클럽 관리자에게 먼저 확인해 주시고, 설정과 무관하게 기록 자체가 보이지 않는
            경우에는 위 이메일로 문의해 주세요.
          </p>
        </section>

        <section className="policy-section">
          <h2>계정 삭제 요청</h2>
          <p>
            계정 및 계정에 저장된 모든 데이터의 삭제를 요청하실 수 있습니다.
            아래 이메일로 <strong>가입에 사용한 이메일 주소</strong>와 함께
            "계정 삭제 요청" 이라고 보내주시면 본인 확인 후 처리해 드립니다.
          </p>
          <div className="contact-info">
            <p><strong>계정 삭제 요청</strong></p>
            <p>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('계정 삭제 요청')}`}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <ul>
            <li>요청 접수 후 영업일 기준 7일 이내에 계정과 운동 기록을 삭제합니다</li>
            <li>삭제된 데이터는 복구할 수 없습니다</li>
            <li>
              부정 이용 방지를 위해 관련 법령이 정한 범위에서 일부 정보가 일정 기간
              보관될 수 있습니다 — 자세한 내용은 개인정보처리방침을 참고해 주세요
            </li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>약관 및 개인정보</h2>
          <ul>
            <li>
              <a href="/privacy-ios">개인정보처리방침</a>
            </li>
            <li>
              <a href="/terms">서비스 이용약관</a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
