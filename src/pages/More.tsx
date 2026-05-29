import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, BookOpen, Smartphone, UserX, Image, MessageSquarePlus, Unlink } from 'lucide-react';
import { InstallGuideModal } from '../components/InstallGuideModal';
import { FeedbackModal } from '../components/FeedbackModal';
import { supabase } from '../lib/supabase';

const KAKAO_SHARE_KEY = 'kakao_share_auto_popup';
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;

export const More = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [kakaoShareOn, setKakaoShareOn] = useState(
    () => localStorage.getItem(KAKAO_SHARE_KEY) !== 'false'
  );
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);
  const [stravaToast, setStravaToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .maybeSingle()
      .then(({ data }) => setStravaConnected(!!data));
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

  return (
    <div className="container">
      <div className="header">
        <h1>더보기</h1>
      </div>

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

      <div className="section">
        <h3>외부 연동</h3>
        <div className="menu-list">
          <div className="menu-item-btn" style={{ cursor: 'default' }}>
            <div className="menu-item-left">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Strava_Logo.svg/32px-Strava_Logo.svg.png"
                alt="Strava"
                style={{ width: 20, height: 20, objectFit: 'contain' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Strava</span>
                <span style={{ fontSize: 11, color: '#888' }}>
                  {stravaConnected === null
                    ? '확인 중...'
                    : stravaConnected
                    ? '연동됨 — 러닝/사이클/수영 자동 기록'
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
                  border: '1px solid #ddd',
                  background: '#fff',
                  color: '#666',
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

      <div className="section">
        <h3>앱 설정</h3>
        <div className="menu-list">
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

      {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
};
