import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import clubService from '../services/clubService';
import type { Club } from '../services/clubService';
import { detectInApp, getPlatform, isNativeApp } from '../utils/browserEnv';

/**
 * 초대 게이트웨이 — 카카오로 공유된 클럽 초대 링크의 착지점.
 *
 * 받는 사람의 환경을 판별해 각 경로로 인계한다:
 *   앱 웹뷰    → /join/:code 로 즉시 통과 (설치 안내가 무의미)
 *   카톡 인앱  → 외부 브라우저 안내 (카톡 안에서는 카카오 로그인이 차단됨)
 *   iOS        → App Store 우선
 *   Android    → 웹 우선 (Android 는 공개 스토어 링크가 없다 — 비공개 테스트 중)
 *   데스크톱   → 웹
 *
 * 비로그인 외부인이 보는 첫 화면이라 앱 셸(Header/BottomNav) 밖 public 라우트에 둔다.
 * 설계: docs/plans/kakao-invite-app-onboarding.md
 */

const IOS_STORE_FALLBACK = 'https://apps.apple.com/kr/app/cardioxclub/id6779019606';

export const InviteLanding = () => {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const platform = getPlatform();
  const inApp = detectInApp();

  const [club, setClub] = useState<Club | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [iosUrl, setIosUrl] = useState(IOS_STORE_FALLBACK);
  const [copied, setCopied] = useState(false);
  // ?to=install 로 들어오면(카카오 "앱 설치하기" 버튼) 절차 안내를 펼친 채로 시작
  const [showSteps, setShowSteps] = useState(searchParams.get('to') === 'install');

  // 이미 앱 안이면 게이트웨이를 보여줄 이유가 없다 — 바로 가입 플로우로
  useEffect(() => {
    if (code && isNativeApp()) {
      navigate(`/join/${code}`, { replace: true });
    }
  }, [code, navigate]);

  useEffect(() => {
    if (!code || isNativeApp()) return;
    let alive = true;

    (async () => {
      try {
        // RLS 상 clubs/club_members SELECT 는 anon 에게 열려 있어 비로그인도 조회된다
        const preview = await clubService.getClubPreviewByInviteCode(code);
        if (!alive) return;
        if (!preview) {
          setErrorMsg('존재하지 않거나 종료된 초대 링크입니다.');
        } else {
          setClub(preview.club);
          setOwnerName(preview.ownerName);
        }
      } catch (err: any) {
        console.error('[초대] 클럽 미리보기 조회 실패:', JSON.stringify(err), err);
        if (alive) {
          setErrorMsg(`클럽 정보를 불러오지 못했습니다: ${err?.message || err?.hint || JSON.stringify(err)}`);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [code]);

  // iOS 스토어 링크는 app_releases 에서 (없으면 상수 폴백)
  useEffect(() => {
    if (platform !== 'ios') return;
    supabase
      .from('app_releases')
      .select('url')
      .eq('platform', 'ios')
      .order('released_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[초대] iOS 릴리스 조회 실패, 기본 링크 사용:', JSON.stringify(error), error);
          return;
        }
        if (data?.url) setIosUrl(data.url);
      });
  }, [platform]);

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.left = '-999999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      console.error('[초대] 코드 복사 실패:', JSON.stringify(err), err);
    }
  };

  const handleEscapeInApp = () => {
    const url = window.location.href;
    if (platform === 'android') {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    }
    // iOS 는 이 스킴도 막혀 있어 안내 문구만 노출한다 (아래 배너)
  };

  const goJoin = () => navigate(`/join/${code}`);

  if (isNativeApp()) return null; // 위 useEffect 가 리다이렉트 중

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {loading ? (
          <div style={S.center}><div className="spinner" /></div>
        ) : errorMsg ? (
          <div style={S.card}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>초대를 확인할 수 없습니다</p>
            <p style={S.muted}>{errorMsg}</p>
          </div>
        ) : club ? (
          <>
            {/* 클럽 미리보기 — 비로그인도 보인다 */}
            <div style={S.card}>
              <div style={S.clubHead}>
                {club.logo_url ? (
                  <img src={club.logo_url} alt={club.name} style={S.logo} />
                ) : (
                  <div style={{ ...S.logo, ...S.logoFallback }}>{club.name[0]}</div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={S.inviteLabel}>클럽 초대</div>
                  <h1 style={S.clubName}>{club.name}</h1>
                  {ownerName && <div style={S.muted}>클럽장 {ownerName}</div>}
                </div>
              </div>
              {club.description && <p style={S.desc}>{club.description}</p>}
            </div>

            {/* 카톡 인앱 — 여기서는 카카오 로그인이 차단된다 */}
            {inApp === 'kakaotalk' && (
              <div style={S.warn}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  ⚠ 카카오톡 안에서는 로그인이 안 됩니다
                </div>
                {platform === 'android' ? (
                  <>
                    <div style={S.warnBody}>아래 버튼을 눌러 Chrome 등 외부 브라우저로 열어주세요.</div>
                    <button type="button" onClick={handleEscapeInApp} style={S.warnBtn}>
                      외부 브라우저로 열기
                    </button>
                  </>
                ) : (
                  <div style={S.warnBody}>
                    오른쪽 위 <strong>⋯ 메뉴 → "다른 브라우저로 열기"</strong>(Safari)를 눌러 다시 열어주세요.
                  </div>
                )}
              </div>
            )}

            {/* 초대코드 — 스토어를 경유하면 맥락이 끊기므로 항상 노출한다 */}
            <div style={S.codeBox}>
              <div style={S.codeLabel}>초대코드</div>
              <div style={S.codeRow}>
                <span style={S.codeValue}>{code}</span>
                <button type="button" onClick={handleCopyCode} style={S.copyBtn}>
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
            </div>

            {/* 환경별 CTA */}
            <div style={S.ctaCol}>
              {platform === 'ios' ? (
                <>
                  <a
                    href={iosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={S.primaryBtn}
                    onClick={() => setShowSteps(true)}
                  >
                    앱 설치하고 가입하기
                  </a>
                  <button type="button" onClick={goJoin} style={S.secondaryBtn}>
                    웹으로 계속하기
                  </button>
                </>
              ) : platform === 'android' ? (
                <>
                  <button type="button" onClick={goJoin} style={S.primaryBtn}>
                    웹으로 클럽 가입하기
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/download')}
                    style={S.secondaryBtn}
                  >
                    Android 앱 알림 받기
                  </button>
                  <p style={S.note}>Android 앱은 준비 중이에요. 지금은 웹으로 바로 이용할 수 있습니다.</p>
                </>
              ) : (
                <>
                  <button type="button" onClick={goJoin} style={S.primaryBtn}>
                    웹으로 클럽 가입하기
                  </button>
                  <p style={S.note}>휴대폰에서 열면 앱으로도 이용할 수 있어요.</p>
                </>
              )}
            </div>

            {/* 앱에서 가입하는 방법 — 스토어 갔다 온 뒤 뭘 눌러야 하는지 미리 읽힌다 */}
            <div style={S.steps}>
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                style={S.stepsToggle}
              >
                <span>앱에서 가입하는 방법</span>
                <span>{showSteps ? '▲' : '▼'}</span>
              </button>
              {showSteps && (
                <ol style={S.stepsList}>
                  <li>앱을 설치하고 실행합니다.</li>
                  <li>카카오로 로그인합니다.</li>
                  <li>하단 <strong>클럽</strong> 탭 → 우측 상단 <strong>+</strong> → <strong>초대코드로 가입</strong>.</li>
                  <li>위 초대코드 <strong>{code}</strong> 를 입력하면 가입 완료!</li>
                </ol>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

// 앱 셸 밖 독립 랜딩이라 이 파일 안에서 스타일을 갖는다.
// 색은 전부 테마 토큰 — 첫인상 화면이라 다크모드에서 깨지면 그대로 이탈이다.
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100%', background: 'var(--body-bg)', padding: '32px 16px 48px' },
  wrap: { maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 },
  center: { display: 'flex', justifyContent: 'center', padding: 48 },
  card: {
    background: 'var(--card-bg)', borderRadius: 16, padding: 20,
    border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)',
  },
  clubHead: { display: 'flex', alignItems: 'center', gap: 14 },
  logo: { width: 56, height: 56, borderRadius: 14, objectFit: 'cover', flexShrink: 0 },
  logoFallback: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--primary-color)', color: 'var(--on-accent)', fontSize: 24, fontWeight: 700,
  },
  inviteLabel: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 },
  clubName: { fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 },
  desc: { marginTop: 14, marginBottom: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' },
  muted: { fontSize: 13, color: 'var(--text-secondary)' },

  warn: {
    background: 'var(--warning-tint)', border: '1px solid #FFCA28', borderRadius: 12,
    padding: '14px 16px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)',
  },
  warnBody: { fontSize: 13.5, color: 'var(--text-secondary)' },
  warnBtn: {
    marginTop: 10, width: '100%', padding: '11px 12px', background: '#FFA000',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },

  codeBox: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
    borderRadius: 12, padding: '14px 16px',
  },
  codeLabel: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 },
  codeRow: { display: 'flex', alignItems: 'center', gap: 10 },
  codeValue: {
    flex: 1, fontSize: 24, fontWeight: 700, letterSpacing: 4,
    color: 'var(--text-primary)', fontFamily: 'monospace',
  },
  copyBtn: {
    flexShrink: 0, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: 'var(--card-hover-bg)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', cursor: 'pointer',
  },

  ctaCol: { display: 'flex', flexDirection: 'column', gap: 10 },
  primaryBtn: {
    display: 'block', width: '100%', textAlign: 'center', padding: '14px 0',
    background: 'var(--primary-color)', color: 'var(--on-accent)',
    borderRadius: 12, fontWeight: 700, fontSize: 15.5, border: 'none',
    textDecoration: 'none', cursor: 'pointer',
  },
  secondaryBtn: {
    display: 'block', width: '100%', textAlign: 'center', padding: '13px 0',
    background: 'var(--card-bg)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: 12,
    fontWeight: 600, fontSize: 15, textDecoration: 'none', cursor: 'pointer',
  },
  note: { margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 },

  steps: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12 },
  stepsToggle: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
  },
  stepsList: {
    margin: 0, padding: '0 16px 16px 34px', fontSize: 13.5, lineHeight: 1.9,
    color: 'var(--text-secondary)',
  },
};
