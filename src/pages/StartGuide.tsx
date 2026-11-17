import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Download, Globe, LogIn, Users,
} from 'lucide-react';
import { detectInApp, getPlatform, isNativeApp } from '../utils/browserEnv';
import { useStoreUrls } from '../utils/storeLinks';

/**
 * 시작 가이드 (/start) — 카카오톡으로 링크 하나만 보내면 읽으면서 바로 설치·로그인·클럽 가입까지
 * 이어지는 공개 온보딩 페이지. 카드뉴스 "Cardio 시작 가이드" 의 웹 대화형 버전.
 *
 *   1. 앱 설치   — 기기 판별해 해당 스토어 버튼을 앞에, "설치 없이 웹으로" 도 같이
 *   2. 카카오 로그인 — 카톡 인앱이면 외부 브라우저 탈출 안내 (카톡 안에선 카카오 로그인 차단)
 *   3. 클럽 가입 — 초대코드는 운영진이 따로 안내. 입력하면 초대 게이트웨이(/i/:code)로
 *
 * 비로그인 외부인이 첫 화면으로 보므로 앱 셸 밖 public 라우트. 스타일은 InviteLanding 과 같은
 * 방식(파일 내 S 객체 + 테마 토큰)이라 다크모드에서도 그대로 동작한다.
 */

const STEPS = [
  { label: '앱 설치', Icon: Download },
  { label: '카카오 로그인', Icon: LogIn },
  { label: '클럽 가입', Icon: Users },
] as const;

const FAQ = [
  {
    q: '카카오 로그인이 안 돼요',
    a: '카카오톡 안에서 연 링크라면 로그인이 막혀 있어요. 앱으로 로그인하거나 Chrome·Safari 로 다시 열어주세요. 그래도 안 되면 로그인 화면 아래 "로그인이 계속 안 되시나요?" 를 눌러주세요.',
  },
  { q: '초대코드가 없어요', a: '초대코드는 클럽마다 달라요. 소속 클럽 운영진에게 요청해 주세요.' },
  {
    q: '운동 기록이 안 들어와요',
    a: 'iPhone 은 설정 → 건강 → 데이터 접근 및 기기 → CardioXclub, Android 는 헬스커넥트에서 카디오x클럽 권한이 켜져 있는지 확인해 주세요. 웹에서는 자동 연동 대신 "+ 기록 추가" 로 직접 입력해요.',
  },
  { q: '앱 설치 없이도 되나요?', a: '네. 휴대폰·PC 브라우저에서 cardio.scnd.kr 로 들어와 같은 카카오 계정으로 쓰면 돼요. 브라우저 메뉴의 "홈 화면에 추가" 를 쓰면 앱처럼 한 번에 열려요.' },
];

export const StartGuide = () => {
  const navigate = useNavigate();
  const platform = getPlatform();
  const inApp = detectInApp();
  const stores = useStoreUrls('시작가이드');

  const stepperRef = useRef<HTMLElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');

  // 이미 앱 안이면 설치 안내가 무의미 — 바로 앱 첫 화면으로
  useEffect(() => {
    if (isNativeApp()) navigate('/', { replace: true });
  }, [navigate]);

  // 현재 단계만 렌더한다. scroll-snap + 프로그램 스크롤은 스크롤 이벤트가 단계를 되돌리는 등
  // WebView 에서 불안정해서, 상태로 바꾸고 스와이프는 터치 델타로 직접 판정한다.
  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    setStep(next);
    // 긴 단계 아래쪽에서 "다음" 을 눌렀으면 새 단계의 맨 위가 보이게
    const el = stepperRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 세로 스크롤과 구분: 가로로 충분히, 세로보다 크게 움직였을 때만
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) goTo(step + (dx < 0 ? 1 : -1));
  };

  const handleEscapeInApp = () => {
    // 안드로이드 카톡만 외부 브라우저 열기 스킴이 동작한다. iOS 는 안내 문구로 대신.
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
  };

  const handleCode = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (c.length !== 6) {
      setCodeError('초대코드 6자리를 입력해 주세요.');
      return;
    }
    navigate(`/i/${encodeURIComponent(c)}`);
  };

  if (isNativeApp()) return null;

  const isMobile = platform === 'ios' || platform === 'android';
  const primaryStore = platform === 'android'
    ? { name: 'Google Play', url: stores.android, search: '카디오x클럽' }
    : { name: 'App Store', url: stores.ios, search: 'CardioXclub (영문)' };
  const otherStore = platform === 'android'
    ? { name: 'iPhone 이에요 → App Store', url: stores.ios }
    : { name: 'Android 폰이에요 → Google Play', url: stores.android };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* 히어로 */}
        <header style={S.hero}>
          <div style={S.brand}>CARDIO × CLUB</div>
          <h1 style={S.title}>카디오 클럽<br />시작 가이드</h1>
          <p style={S.sub}>이 링크 하나로 설치부터 클럽 가입까지, 3단계면 끝나요.</p>
        </header>

        {inApp === 'kakaotalk' && (
          <div style={S.warn} role="note">
            <div style={S.warnHead}><AlertTriangle size={18} /> 카카오톡 안에서는 카카오 로그인이 막혀요</div>
            <div style={S.warnBody}>
              읽기와 앱 설치는 여기서 해도 돼요. 웹으로 로그인할 땐
              {platform === 'android'
                ? ' 아래 버튼으로 외부 브라우저에서 열어주세요.'
                : <> 화면의 <strong>⋯ 메뉴 → 다른 브라우저로 열기</strong>(Safari) 를 눌러주세요.</>}
            </div>
            {platform === 'android' && (
              <button type="button" onClick={handleEscapeInApp} style={S.warnBtn}>외부 브라우저로 열기</button>
            )}
          </div>
        )}

        {/* 미리보기 */}
        <section style={S.preview} aria-label="앱 화면 미리보기">
          <figure style={S.shotFig}>
            <img src="/start/records.png" alt="기록 탭: 최근 6개월 운동 추이와 이번 달 통계" style={S.shot} loading="lazy" />
            <figcaption style={S.shotCap}>내 운동 기록·통계</figcaption>
          </figure>
          <figure style={S.shotFig}>
            <img src="/start/club.png" alt="클럽 탭: 클럽 멤버들의 오늘 운동" style={S.shot} loading="lazy" />
            <figcaption style={S.shotCap}>클럽 멤버 오늘운동</figcaption>
          </figure>
        </section>

        {/* 3단계 스텝퍼 */}
        <section ref={stepperRef} style={S.stepper} aria-label="시작하기 3단계">
          <div style={S.tabs} role="tablist">
            {STEPS.map(({ label, Icon }, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={step === i}
                onClick={() => goTo(i)}
                style={{ ...S.tab, ...(step === i ? S.tabOn : null) }}
              >
                <span style={{ ...S.tabNum, ...(step === i ? S.tabNumOn : null) }}>
                  {step > i ? <Check size={14} /> : i + 1}
                </span>
                <span style={S.tabLabel}><Icon size={14} /> {label}</span>
              </button>
            ))}
          </div>

          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={S.track}>
            {/* STEP 1 — 설치 */}
            {step === 0 && (
            <div style={S.slide}>
              <div style={S.slideHead}>STEP 1</div>
              <h2 style={S.slideTitle}>앱 설치하기</h2>
              {isMobile ? (
                <>
                  <a href={primaryStore.url} target="_blank" rel="noopener noreferrer" style={S.primaryBtn}>
                    {primaryStore.name}에서 설치
                  </a>
                  <p style={S.hint}>스토어 검색어: <strong>{primaryStore.search}</strong></p>
                  <a href={otherStore.url} target="_blank" rel="noopener noreferrer" style={S.textLink}>{otherStore.name}</a>
                </>
              ) : (
                <>
                  <div style={S.btnRow}>
                    <a href={stores.android} target="_blank" rel="noopener noreferrer" style={S.primaryBtn}>Google Play</a>
                    <a href={stores.ios} target="_blank" rel="noopener noreferrer" style={S.primaryBtn}>App Store</a>
                  </div>
                  <p style={S.hint}>휴대폰에서 이 링크를 열면 바로 설치할 수 있어요.</p>
                </>
              )}
              <div style={S.infoBox}>
                운동 기록은 Android 는 <strong>헬스커넥트</strong>, iPhone 은 <strong>건강 앱</strong>에서 자동으로 들어와요.
                처음 실행할 때 뜨는 권한을 꼭 허용해 주세요.
              </div>
              <div style={S.divider}><span>설치가 어렵다면</span></div>
              <button type="button" onClick={() => navigate('/')} style={S.secondaryBtn}>
                <Globe size={16} /> 설치 없이 웹으로 시작
              </button>
              <p style={S.hint}>같은 카카오 계정, 같은 기록. 웹은 자동 연동 대신 "+ 기록 추가" 로 입력해요.</p>
            </div>
            )}

            {/* STEP 2 — 로그인 */}
            {step === 1 && (
            <div style={S.slide}>
              <div style={S.slideHead}>STEP 2</div>
              <h2 style={S.slideTitle}>카카오로 가입하기</h2>
              <p style={S.lead}>아이디·비밀번호를 만들 필요가 없어요. 처음 로그인하면 그대로 가입돼요.</p>
              <ol style={S.ol}>
                <li style={S.li}><span style={S.liNum}>1</span>앱(또는 웹)을 열고</li>
                <li style={S.li}><span style={S.liNum}>2</span><span style={S.kakaoChip}>카카오 로그인하기</span> 누르기</li>
                <li style={S.li}><span style={S.liNum}>3</span>정보 제공(이름·이메일)에 동의</li>
                <li style={S.li}><span style={{ ...S.liNum, ...S.liNumDone }}><Check size={14} /></span>가입 완료!</li>
              </ol>
              <div style={S.infoBox}>
                둘러보기만 하고 싶다면 로그인 화면의 <strong>데모 체험하기</strong>로 먼저 구경할 수 있어요.
              </div>
              <button type="button" onClick={() => navigate('/')} style={S.secondaryBtn}>
                <LogIn size={16} /> 웹에서 로그인하기
              </button>
            </div>
            )}

            {/* STEP 3 — 클럽 가입 */}
            {step === 2 && (
            <div style={S.slide}>
              <div style={S.slideHead}>STEP 3</div>
              <h2 style={S.slideTitle}>클럽 가입하기</h2>
              <div style={S.codeNotice}>
                초대코드 6자리는 <strong>클럽 운영진에게 따로 안내</strong>받아 주세요.
              </div>
              <form onSubmit={handleCode} style={S.codeForm}>
                <label htmlFor="start-code" style={S.codeLabel}>받은 초대코드가 있다면</label>
                <div style={S.codeRow}>
                  <input
                    id="start-code"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(''); }}
                    maxLength={6}
                    placeholder="6자리"
                    autoCapitalize="characters"
                    autoComplete="off"
                    style={S.codeInput}
                  />
                  <button type="submit" style={S.codeBtn}>클럽 확인</button>
                </div>
                {codeError && <p style={S.codeError}>{codeError}</p>}
              </form>
              <p style={S.lead}>앱 안에서는 이렇게 입력해요.</p>
              <ol style={S.ol}>
                <li style={S.li}><span style={S.liNum}>1</span>하단 <strong>클럽</strong> 탭 → 오른쪽 위 <strong>+</strong></li>
                <li style={S.li}><span style={S.liNum}>2</span><strong>초대코드로 가입</strong> → 코드 입력</li>
                <li style={S.li}><span style={{ ...S.liNum, ...S.liNumDone }}><Check size={14} /></span>별명 정하고 <strong>클럽 가입하기</strong></li>
              </ol>
            </div>
            )}
          </div>

          <div style={S.navRow}>
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              style={{ ...S.navBtn, ...(step === 0 ? S.navBtnOff : null) }}
              aria-label="이전 단계"
            >
              <ChevronLeft size={18} /> 이전
            </button>
            <div style={S.dots} aria-hidden="true">
              {STEPS.map((s, i) => (
                <span key={s.label} style={{ ...S.dot, ...(step === i ? S.dotOn : null) }} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              disabled={step === STEPS.length - 1}
              style={{ ...S.navBtn, ...(step === STEPS.length - 1 ? S.navBtnOff : null) }}
              aria-label="다음 단계"
            >
              다음 <ChevronRight size={18} />
            </button>
          </div>
        </section>

        {/* 자주 묻는 질문 */}
        <section style={S.faq} aria-label="자주 묻는 질문">
          <h2 style={S.faqTitle}>자주 묻는 질문</h2>
          {FAQ.map(({ q, a }) => (
            <details key={q} style={S.faqItem}>
              <summary style={S.faqQ}>{q}</summary>
              <p style={S.faqA}>{a}</p>
            </details>
          ))}
        </section>

        <footer style={S.footer}>
          <a href="/download" style={S.footLink}>스토어 링크 모음</a>
          <span aria-hidden="true">·</span>
          <a href="/support" style={S.footLink}>문의하기</a>
        </footer>
      </div>
    </div>
  );
};

// 앱 셸 밖 독립 랜딩이라 이 파일 안에서 스타일을 갖는다 (InviteLanding 과 같은 방식).
// 구조색은 전부 테마 토큰. 상태색(경고)·카카오 브랜드색만 고정값.
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100%', background: 'var(--body-bg)', padding: '28px 16px 48px', color: 'var(--text-primary)' },
  wrap: { maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },

  hero: { padding: '8px 4px 0' },
  brand: { fontSize: 12, fontWeight: 800, letterSpacing: 3, color: 'var(--primary-color)' },
  title: { margin: '10px 0 8px', fontSize: 34, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.5 },
  sub: { margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-secondary)' },

  warn: {
    background: 'var(--warning-tint)', border: '1px solid #FFCA28', borderRadius: 14,
    padding: '14px 16px', fontSize: 14, lineHeight: 1.55,
  },
  warnHead: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 },
  warnBody: { fontSize: 13.5, color: 'var(--text-secondary)' },
  warnBtn: {
    marginTop: 10, width: '100%', padding: '11px 12px', background: '#FFA000', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },

  preview: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  shotFig: { margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  shot: {
    width: '100%', aspectRatio: '390 / 600', objectFit: 'cover', objectPosition: 'top',
    borderRadius: 18, border: '6px solid var(--border-color)', background: 'var(--card-bg)', display: 'block',
    boxSizing: 'border-box',
  },
  shotCap: { fontSize: 13, fontWeight: 600, textAlign: 'center', color: 'var(--text-secondary)' },

  stepper: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 20,
    boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
  },
  tabs: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderBottom: '1px solid var(--border-color)' },
  tab: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 4px 12px',
    // 롱핸드로만 쓴다 — 단축속성과 섞으면 선택 해제 시 React 가 borderBottomColor 를 지워 글자색(검정) 선이 남는다
    background: 'none', borderTop: 0, borderLeft: 0, borderRight: 0,
    borderBottomWidth: 3, borderBottomStyle: 'solid', borderBottomColor: 'transparent', cursor: 'pointer',
    color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, minHeight: 44,
  },
  tabOn: { color: 'var(--primary-color)', borderBottomColor: 'var(--primary-color)' },
  tabNum: {
    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--card-hover-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 800,
  },
  tabNumOn: { background: 'var(--primary-color)', color: 'var(--on-accent)' },
  tabLabel: { display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' },

  track: { touchAction: 'pan-y' },
  slide: {
    boxSizing: 'border-box', padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 12,
  },
  slideHead: { fontSize: 12, fontWeight: 800, letterSpacing: 2, color: 'var(--primary-color)' },
  slideTitle: { margin: '0 0 4px', fontSize: 24, fontWeight: 800 },
  lead: { margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-secondary)' },
  hint: { margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', textAlign: 'center' },

  btnRow: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  primaryBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50,
    background: 'var(--primary-color)', color: 'var(--on-accent)', borderRadius: 14,
    fontWeight: 800, fontSize: 16, textDecoration: 'none', border: 'none', cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48,
    background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
    borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer',
  },
  textLink: { fontSize: 13.5, textAlign: 'center', color: 'var(--text-secondary)', textDecoration: 'underline', padding: '6px 0' },
  infoBox: {
    background: 'var(--card-hover-bg)', borderRadius: 12, padding: '12px 14px',
    fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-secondary)',
    marginTop: 4,
  },

  ol: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  li: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, lineHeight: 1.5 },
  liNum: {
    width: 28, height: 28, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--primary-color)', color: 'var(--on-accent)', fontSize: 13, fontWeight: 800,
  },
  liNumDone: { background: 'var(--secondary-color)' },
  kakaoChip: {
    background: '#FEE500', color: '#191919', borderRadius: 8, padding: '3px 10px', fontWeight: 700, fontSize: 14,
    marginRight: 4,
  },

  codeNotice: {
    border: '2px solid var(--secondary-color)', borderRadius: 14, padding: '14px 16px',
    fontSize: 15, lineHeight: 1.55,
  },
  codeForm: { display: 'flex', flexDirection: 'column', gap: 8 },
  codeLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' },
  codeRow: { display: 'flex', gap: 8 },
  codeInput: {
    flex: 1, minWidth: 0, height: 48, boxSizing: 'border-box', padding: '0 14px', borderRadius: 12,
    border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-primary)',
    fontSize: 20, fontWeight: 700, letterSpacing: 4, fontFamily: 'monospace',
  },
  codeBtn: {
    flexShrink: 0, height: 48, padding: '0 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'var(--primary-color)', color: 'var(--on-accent)', fontSize: 15, fontWeight: 700,
  },
  codeError: { margin: 0, fontSize: 13, color: '#ef4444' },

  navRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '12px 16px 16px',
  },
  navBtn: {
    display: 'flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 14px', borderRadius: 12,
    border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  navBtnOff: { opacity: 0.35, cursor: 'default' },
  dots: { display: 'flex', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, background: 'var(--border-color)', transition: 'width 0.2s' },
  dotOn: { width: 20, background: 'var(--primary-color)' },

  faq: { display: 'flex', flexDirection: 'column', gap: 8 },
  faqTitle: { margin: '6px 4px 4px', fontSize: 18, fontWeight: 800 },
  faqItem: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '0 16px',
  },
  faqQ: { padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 20 },
  faqA: { margin: '0 0 14px', fontSize: 14, lineHeight: 1.65, color: 'var(--text-secondary)' },

  footer: {
    display: 'flex', justifyContent: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', paddingTop: 8,
  },
  footLink: { color: 'var(--text-secondary)', textDecoration: 'underline', padding: '8px 4px' },
};
