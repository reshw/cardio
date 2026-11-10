import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ShieldCheck, BookOpen, Smartphone, UserX, Image, MessageSquarePlus, Unlink, Trash2, GitMerge } from 'lucide-react';
import { InstallGuideModal } from '../components/InstallGuideModal';
import { FeedbackModal } from '../components/FeedbackModal';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { useHealthSync } from '../hooks/useHealthSync';
import userService from '../services/userService';
import { useModalHistory } from '../hooks/useModalHistory';

const KAKAO_SHARE_KEY = 'kakao_share_auto_popup';
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;

// "외부 연동"(Strava) 섹션 노출 여부. 연동 로직·OAuth 콜백 처리는 그대로 두고 UI 만
// 숨긴다 — 건강정보 연동은 네이티브 앱 쪽에 별도 메뉴가 생겨서 여기 것과 중복이다
// (2026-08-12). 되살릴 땐 이 값만 true 로 바꾸면 된다.
const SHOW_EXTERNAL_INTEGRATIONS = false;

export const More = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const healthSync = useHealthSync();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [blockingRoles, setBlockingRoles] = useState<
    { clubId: string; clubName: string; role: string }[] | null
  >(null);
  const [checkingRoles, setCheckingRoles] = useState(false);
  const [kakaoShareOn, setKakaoShareOn] = useState(
    () => localStorage.getItem(KAKAO_SHARE_KEY) !== 'false'
  );
  const [pushOn, setPushOn] = useState(true);
  const [pushToggling, setPushToggling] = useState(false);
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);
  const [stravaInfo, setStravaInfo] = useState<{ name: string; profile: string | null } | null>(null);
  const [stravaToast, setStravaToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('push_muted')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[더보기] 푸시 설정 조회 실패 상세:', JSON.stringify(error), error);
          return;
        }
        setPushOn(!data?.push_muted);
      });
  }, [user]);

  const togglePush = async () => {
    if (!user || pushToggling) return;
    const next = !pushOn;
    setPushToggling(true);
    setPushOn(next); // 낙관적 업데이트, 실패 시 되돌림
    const { error } = await supabase
      .from('users')
      .update({ push_muted: !next })
      .eq('id', user.id);
    if (error) {
      console.error('[더보기] 푸시 설정 변경 실패 상세:', JSON.stringify(error), error);
      setPushOn(!next);
      alert(`푸시 알림 설정 변경 실패: ${error.message || JSON.stringify(error)}`);
    }
    setPushToggling(false);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_integrations')
      .select('id, athlete_name, athlete_profile')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .maybeSingle()
      .then(({ data }) => {
        setStravaConnected(!!data);
        if (data?.athlete_name) {
          setStravaInfo({ name: data.athlete_name, profile: data.athlete_profile ?? null });
        }
      });
  }, [user]);

  useEffect(() => {
    const stravaParam = searchParams.get('strava');
    if (!stravaParam) return;

    if (stravaParam === 'connected') {
      setStravaConnected(true);
      setStravaToast({ type: 'success', message: 'Strava 연동 완료! 이제 달리면 자동으로 기록됩니다.' });
    } else if (stravaParam === 'error') {
      const reason = searchParams.get('reason') || '';
      setStravaToast({ type: 'error', message: `Strava 연동 실패 (${reason})` });
    }

    setSearchParams({}, { replace: true });
    setTimeout(() => setStravaToast(null), 4000);
  }, []);

  const connectStrava = () => {
    if (!user || !STRAVA_CLIENT_ID) return;
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/strava/callback`);
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all&state=${user.id}`;
    window.location.href = url;
  };

  const disconnectStrava = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'strava');

    if (!error) {
      setStravaConnected(false);
      setStravaToast({ type: 'success', message: 'Strava 연동이 해제되었습니다.' });
      setTimeout(() => setStravaToast(null), 3000);
    }
  };

  const toggleKakaoShare = () => {
    const next = !kakaoShareOn;
    setKakaoShareOn(next);
    localStorage.setItem(KAKAO_SHARE_KEY, next ? 'true' : 'false');
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      await userService.deleteAccount();
      // 탈퇴 후엔 세션이 가리키는 row 가 끊겼으므로 반드시 로그아웃까지 해야 한다.
      logout();
      navigate('/');
    } catch (err: any) {
      console.error('[계정 삭제] 실패 상세:', JSON.stringify(err), err);
      const msg = err?.message || err?.error_description || err?.hint || JSON.stringify(err);
      alert(`계정 삭제에 실패했습니다.\n\n${msg}\n\n계속 실패하면 shy@lunagarden.co.kr 로 문의해 주세요.`);
      setDeletingAccount(false);
    }
  };

  // 클럽장/부매니저면 양도가 먼저다 — 모달을 열기 전에 확인한다.
  const openDeleteAccount = async () => {
    if (!user) return;
    setCheckingRoles(true);
    try {
      setBlockingRoles(await userService.getClubRolesBlockingDeletion(user.id));
      setShowDeleteAccount(true);
    } catch (err: any) {
      console.error('[계정 탈퇴] 클럽 직책 확인 실패 상세:', JSON.stringify(err), err);
      const msg = err?.message || err?.hint || JSON.stringify(err);
      alert(`클럽 직책을 확인하지 못했습니다.\n\n${msg}`);
    } finally {
      setCheckingRoles(false);
    }
  };

  const closeDeleteAccount = () => {
    if (deletingAccount) return;
    setShowDeleteAccount(false);
    setDeleteConfirmText('');
    setBlockingRoles(null);
  };

  useModalHistory(showDeleteAccount, closeDeleteAccount);

  return (
    <div className="container">
      {/* 페이지 제목("더보기")은 전역 Header 가 경로로 판단해 이미 렌더한다 (Header.tsx) —
          여기서 h1 을 또 두면 화면에 "더보기"가 두 번 나온다 */}

      {stravaToast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: stravaToast.type === 'success' ? '#22c55e' : '#ef4444',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          {stravaToast.message}
        </div>
      )}

      {user?.is_admin && (
        <div className="section">
          <h3>관리자 메뉴</h3>
          <button
            className="admin-menu-button"
            onClick={() => navigate('/admin')}
          >
            <Shield size={20} />
            <span>어드민 관리</span>
          </button>
          {user?.is_super_admin && (
            <button
              className="admin-menu-button"
              onClick={() => navigate('/admin/image-settings')}
              style={{ marginTop: '12px' }}
            >
              <Image size={20} />
              <span>이미지 업로드 설정</span>
            </button>
          )}
        </div>
      )}

      {SHOW_EXTERNAL_INTEGRATIONS && (
      <div className="section">
        <h3>외부 연동</h3>
        <div className="menu-list">
          <div className="menu-item-btn" style={{ cursor: 'default' }}>
            <div className="menu-item-left">
              <img
                src="https://cdn.simpleicons.org/strava/FC4C02"
                alt="Strava"
                style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }}
              />
              {stravaConnected && stravaInfo?.profile && (
                <img
                  src={stravaInfo.profile}
                  alt={stravaInfo.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Strava</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {stravaConnected === null
                    ? '확인 중...'
                    : stravaConnected
                    ? (stravaInfo?.name ?? '연동됨')
                    : '연동하면 운동이 자동으로 기록됩니다'}
                </span>
              </div>
            </div>
            {stravaConnected === null ? null : stravaConnected ? (
              <button
                onClick={disconnectStrava}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Unlink size={14} />
                해제
              </button>
            ) : (
              <button
                onClick={connectStrava}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#FC4C02',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                연동
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      <div className="section">
        <h3>앱 설정</h3>
        <div className="menu-list">
          <div className="menu-item-btn" style={{ cursor: 'default' }}>
            <div className="menu-item-left">
              <span style={{ fontSize: 20 }}>{isDark ? '🌙' : '☀️'}</span>
              <span>다크 모드</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={isDark} onChange={toggleTheme} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="menu-item-btn" style={{ cursor: 'default' }}>
            <div className="menu-item-left">
              <span style={{ fontSize: 20 }}>💬</span>
              <span>운동 후 카톡 공유 창 자동 표시</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={kakaoShareOn} onChange={toggleKakaoShare} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="menu-item-btn" style={{ cursor: 'default' }}>
            <div className="menu-item-left">
              <span style={{ fontSize: 20 }}>🔔</span>
              <span>좋아요·댓글 푸시 알림</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={pushOn} onChange={togglePush} disabled={pushToggling} />
              <span className="toggle-slider" />
            </label>
          </div>
          {healthSync.available && (
            <div className="menu-item-btn" style={{ cursor: 'default' }}>
              <div className="menu-item-left">
                <span style={{ fontSize: 20 }}>❤️‍🩹</span>
                <span>헬스 데이터 자동 동기화</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={healthSync.enabled}
                  onChange={() => healthSync.setEnabled(!healthSync.enabled)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          )}
          {typeof window !== 'undefined' && window.CardioNative?.openHealthSync && (
            <button
              className="menu-item-btn"
              onClick={() => window.CardioNative?.openHealthSync?.()}
            >
              <div className="menu-item-left">
                <span style={{ fontSize: 20 }}>❤️‍🩹</span>
                <span>건강 데이터 동기화 관리</span>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="section">
        <h3>멤버 관리</h3>
        <div className="menu-list">
          <button
            className="menu-item-btn"
            onClick={() => navigate('/blocked-members')}
          >
            <div className="menu-item-left">
              <UserX size={20} />
              <span>차단한 멤버 관리</span>
            </div>
          </button>
        </div>
      </div>

      {!user?.isGuest && (
        <div className="section">
          <h3>디버그 도구</h3>
          <div className="menu-list">
            <button
              className="menu-item-btn"
              onClick={() => navigate('/debug/merge-requests')}
            >
              <div className="menu-item-left">
                <GitMerge size={20} />
                <span>개인 기록 병합신청</span>
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="section">
        <h3>앱 정보</h3>
        <div className="menu-list">
          <button
            className="menu-item-btn"
            onClick={() => navigate('/guide')}
          >
            <div className="menu-item-left">
              <BookOpen size={20} />
              <span>사용 설명</span>
            </div>
          </button>
          <button
            className="menu-item-btn"
            onClick={() => setShowInstallGuide(true)}
          >
            <div className="menu-item-left">
              <Smartphone size={20} />
              <span>앱 설치 안내</span>
            </div>
          </button>
          <button
            className="menu-item-btn"
            onClick={() => setShowFeedback(true)}
          >
            <div className="menu-item-left">
              <MessageSquarePlus size={20} />
              <span>수정 요청 / 버그 제보</span>
            </div>
          </button>
          <button
            className="menu-item-btn"
            onClick={() => navigate('/privacy-ios')}
          >
            <div className="menu-item-left">
              <ShieldCheck size={20} />
              <span>개인정보 처리방침</span>
            </div>
          </button>
        </div>
      </div>

      <div className="section">
        <h3>사용자 정보</h3>
        <p><strong>이름:</strong> {user?.display_name}</p>
        <p><strong>이메일:</strong> {user?.email || '없음'}</p>
        {user?.profile_image && (
          <div style={{ marginTop: '16px' }}>
            <img
              src={user.profile_image}
              alt="프로필"
              style={{ width: '80px', height: '80px', borderRadius: '50%' }}
            />
          </div>
        )}
      </div>

      <button className="primary-button" onClick={logout}>
        로그아웃
      </button>

      {/* 데모(게스트) 계정은 여러 사람이 함께 쓰므로 탈퇴 대상이 아니다 */}
      {!user?.isGuest && (
        <button className="delete-account-btn" onClick={openDeleteAccount} disabled={checkingRoles}>
          <Trash2 size={16} />
          <span>{checkingRoles ? '확인 중...' : '정보 삭제 후 탈퇴'}</span>
        </button>
      )}

      {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

      {showDeleteAccount &&
        createPortal(
          <div className="modal-overlay" onClick={closeDeleteAccount}>
            <div
              className="modal-content"
              style={{ maxWidth: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>정보 삭제 후 탈퇴</h2>
                <button className="modal-close" onClick={closeDeleteAccount}>
                  ✕
                </button>
              </div>
              {blockingRoles && blockingRoles.length > 0 ? (
                <div className="modal-body">
                  <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
                    클럽을 양도한 후 탈퇴할 수 있습니다.
                  </p>
                  <div className="delete-account-warning">
                    <strong>아래 클럽에서 직책을 맡고 있습니다</strong>
                    <ul>
                      {blockingRoles.map((r) => (
                        <li key={r.clubId}>
                          {r.clubName} — {r.role === 'manager' ? '클럽장' : '부매니저'}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.6 }}>
                    클럽장은 클럽 설정 → 클럽장 양도에서 다른 멤버에게 넘기거나 클럽을 삭제한 뒤,
                    부매니저는 클럽장에게 직책 해제를 요청한 뒤 다시 시도해 주세요.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={closeDeleteAccount}
                    >
                      닫기
                    </button>
                    <button
                      className="primary-button-full"
                      style={{ flex: 1 }}
                      onClick={() => {
                        closeDeleteAccount();
                        navigate('/club');
                      }}
                    >
                      클럽으로 이동
                    </button>
                  </div>
                </div>
              ) : (
              <div className="modal-body">
                <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
                  <strong>{user?.display_name}</strong>님의 계정을 삭제합니다.
                </p>
                <div className="delete-account-warning">
                  <strong>⚠️ 되돌릴 수 없습니다</strong>
                  <ul>
                    <li>이름·이메일·프로필 사진 등 개인정보가 삭제됩니다</li>
                    <li>클럽 멤버십이 해제되고 랭킹에서 제외됩니다</li>
                    <li>다시 로그인해도 이 계정은 복구되지 않고 새 계정으로 시작됩니다</li>
                  </ul>
                </div>
                <p style={{ margin: '16px 0 8px', fontSize: 14 }}>
                  계속하려면 <strong>탈퇴</strong> 를 입력해 주세요.
                </p>
                <input
                  className="delete-account-input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="탈퇴"
                  disabled={deletingAccount}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={closeDeleteAccount}
                    disabled={deletingAccount}
                  >
                    취소
                  </button>
                  <button
                    className="btn-danger"
                    style={{ flex: 1 }}
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount || deleteConfirmText.trim() !== '탈퇴'}
                  >
                    {deletingAccount ? '처리 중...' : '탈퇴하기'}
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
