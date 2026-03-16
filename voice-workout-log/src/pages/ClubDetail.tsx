import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clubService from '../services/clubService';
import challengeService from '../services/challengeService';
import { getClubDashboard, updateDashboardConfig, type ClubDashboardData } from '../storage/clubStorage';
import { formatMetric } from '../utils/calculateMetrics';
import type { HofBadge } from '../utils/dashboardLogic';
import { ChallengeWizard } from '../components/challenge/ChallengeWizard';
import type {
  ClubDetail,
  ClubChallenge,
  ClubMemberWithUser,
  DashboardWidget,
  DashboardConfig,
} from '../types';

type TabType = 'dashboard' | 'challenge' | 'members';

// Default widget configuration
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'live_ticker', type: 'live_ticker', visible: true, order: 0 },
  { id: 'hall_of_fame', type: 'hall_of_fame', visible: true, order: 1 },
  { id: 'daily_squad', type: 'daily_squad', visible: true, order: 2 },
  { id: 'leaderboard_cardio', type: 'leaderboard', visible: true, order: 3, config: { metricType: 'cardio' } },
  { id: 'leaderboard_strength', type: 'leaderboard', visible: true, order: 4, config: { metricType: 'strength' } },
  { id: 'leaderboard_snowboard', type: 'leaderboard', visible: true, order: 5, config: { metricType: 'snowboard' } },
];

export const ClubDetailPage = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabType>('dashboard');
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [dashboardData, setDashboardData] = useState<ClubDashboardData | null>(null);
  const [challenges, setChallenges] = useState<ClubChallenge[]>([]);
  const [members, setMembers] = useState<ClubMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);

  // Widget system state
  const [editMode, setEditMode] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_WIDGETS);
  const [widgetsSaving, setWidgetsSaving] = useState(false);

  useEffect(() => {
    if (clubId) {
      loadClubData();
    }
  }, [clubId]);

  useEffect(() => {
    if (clubId && club) {
      loadTabData();
    }
  }, [tab, club]);

  const loadClubData = async () => {
    if (!clubId) return;

    setLoading(true);
    try {
      const clubData = await clubService.getClubDetail(clubId);
      setClub(clubData);

      // Load dashboard config or use default
      if (clubData.dashboard_config?.widgets) {
        setWidgets(clubData.dashboard_config.widgets);
      } else {
        setWidgets(DEFAULT_WIDGETS);
      }

      // Get my role
      const membersList = await clubService.getClubMembers(clubId);
      const currentUserId = localStorage.getItem('current_user')
        ? JSON.parse(localStorage.getItem('current_user')!).id
        : null;
      const myMembership = membersList.find((m) => m.user_id === currentUserId);
      setMyRole(myMembership?.role || null);
    } catch (error) {
      console.error('클럽 로드 실패:', error);
      alert('클럽을 불러오는데 실패했습니다.');
      navigate('/club');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (!clubId) return;

    try {
      switch (tab) {
        case 'dashboard':
          // Server-side aggregation: DB에서 집계된 대시보드 데이터 조회
          const data = await getClubDashboard(clubId);
          setDashboardData(data);
          break;
        case 'challenge':
          const challengeData = await challengeService.getActiveChallenges(clubId);
          setChallenges(challengeData);
          break;
        case 'members':
          const memberData = await clubService.getClubMembers(clubId);
          setMembers(memberData);
          break;
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  const handleInvite = () => {
    if (!club) return;
    clubService.shareToKakao(club);
  };

  const handleLeave = async () => {
    if (!clubId || !confirm('정말 클럽을 탈퇴하시겠습니까?')) return;

    try {
      await clubService.leaveClub(clubId);
      alert('클럽을 탈퇴했습니다.');
      navigate('/club');
    } catch (error) {
      alert(error instanceof Error ? error.message : '탈퇴에 실패했습니다.');
    }
  };

  // Widget management functions
  const handleToggleWidgetVisibility = (widgetId: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w))
    );
  };

  const handleMoveWidget = (widgetId: string, direction: 'up' | 'down') => {
    setWidgets((prev) => {
      const sortedWidgets = [...prev].sort((a, b) => a.order - b.order);
      const index = sortedWidgets.findIndex((w) => w.id === widgetId);

      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === sortedWidgets.length - 1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [sortedWidgets[index], sortedWidgets[newIndex]] = [sortedWidgets[newIndex], sortedWidgets[index]];

      return sortedWidgets.map((w, i) => ({ ...w, order: i }));
    });
  };

  const handleSaveWidgets = async () => {
    if (!clubId) return;

    setWidgetsSaving(true);
    try {
      const config: DashboardConfig = { widgets };
      await updateDashboardConfig(clubId, config);
      alert('대시보드 설정이 저장되었습니다!');
      setEditMode(false);
      loadClubData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '설정 저장에 실패했습니다.');
    } finally {
      setWidgetsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    // Reload original config
    if (club?.dashboard_config?.widgets) {
      setWidgets(club.dashboard_config.widgets);
    } else {
      setWidgets(DEFAULT_WIDGETS);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">로딩 중...</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="container">
        <div className="empty-state">
          <p>클럽을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate('/club')}>
          ← 뒤로
        </button>
        <h2>{club.name}</h2>
      </div>

      {/* Club Info Card */}
      <div className="section" style={{ marginBottom: '20px' }}>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '12px',
          }}
        >
          {club.description || '설명이 없습니다.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div className="stat-chip">{club.is_public ? '🌐 공개' : '🔒 비공개'}</div>
          <div className="stat-chip">👥 {club.member_count}명</div>
          <div className="stat-chip">🎯 챌린지 {club.active_challenge_count}개</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="primary-button" onClick={handleInvite}>
            📤 초대하기
          </button>
          {myRole !== 'owner' && (
            <button className="cancel-button" onClick={handleLeave}>
              탈퇴
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mode-selector">
        <button
          className={`mode-button ${tab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          대시보드
        </button>
        <button
          className={`mode-button ${tab === 'challenge' ? 'active' : ''}`}
          onClick={() => setTab('challenge')}
        >
          챌린지
        </button>
        <button
          className={`mode-button ${tab === 'members' ? 'active' : ''}`}
          onClick={() => setTab('members')}
        >
          멤버
        </button>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Edit Mode Controls */}
          {(myRole === 'owner' || myRole === 'admin') && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {!editMode ? (
                <button className="primary-button" onClick={() => setEditMode(true)}>
                  🎨 대시보드 편집
                </button>
              ) : (
                <>
                  <button
                    className="primary-button"
                    onClick={handleSaveWidgets}
                    disabled={widgetsSaving}
                  >
                    {widgetsSaving ? '저장 중...' : '💾 저장'}
                  </button>
                  <button className="cancel-button" onClick={handleCancelEdit}>
                    취소
                  </button>
                </>
              )}
            </div>
          )}

          {/* Render Widgets */}
          {widgets
            .sort((a, b) => a.order - b.order)
            .map((widget) => (
              <DashboardWidgetWrapper
                key={widget.id}
                widget={widget}
                editMode={editMode}
                onToggleVisibility={handleToggleWidgetVisibility}
                onMove={handleMoveWidget}
                dashboardData={dashboardData}
              />
            ))}
        </div>
      )}


      {/* Challenge Tab */}
      {tab === 'challenge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(myRole === 'owner' || myRole === 'admin') && (
            <button
              className="primary-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCreateChallenge(true);
              }}
              style={{
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: 1,
              }}
            >
              + 챌린지 만들기
            </button>
          )}
          {challenges.length === 0 ? (
            <div className="empty-state">
              <p>진행 중인 챌린지가 없습니다.</p>
            </div>
          ) : (
            challenges.map((challenge) => {
              const progress = challengeService.calculateProgress(
                challenge.current_value,
                challenge.target_value
              );
              return (
                <div
                  key={challenge.id}
                  className="section"
                  onClick={() => navigate(`/club/${clubId}/challenge/${challenge.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                    {challenge.title}
                  </h3>
                  {challenge.description && (
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginBottom: '12px',
                      }}
                    >
                      {challenge.description}
                    </p>
                  )}
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress-text">
                    {challenge.current_value} / {challenge.target_value} ({progress}%)
                  </div>
                  <div className="log-meta">
                    <span>
                      {challenge.start_date} ~ {challenge.end_date}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {members.map((member) => (
            <div key={member.id} className="log-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="profile-avatar"
                  style={{ width: '40px', height: '40px', fontSize: '16px' }}
                >
                  {member.user.display_name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>
                    {member.user.display_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    @{member.user.username}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    background: 'var(--primary-color)',
                    color: 'white',
                    borderRadius: '6px',
                  }}
                >
                  {member.role === 'owner' && '👑 소유자'}
                  {member.role === 'admin' && '⭐ 관리자'}
                  {member.role === 'member' && '👤 멤버'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Challenge Wizard */}
      {showCreateChallenge && (
        <ChallengeWizard
          clubId={clubId!}
          onClose={() => setShowCreateChallenge(false)}
          onSuccess={() => {
            setShowCreateChallenge(false);
            loadTabData();
          }}
        />
      )}
    </div>
  );
};


// ============================================
// Dashboard Widget Wrapper
// ============================================

interface WidgetWrapperProps {
  widget: DashboardWidget;
  editMode: boolean;
  onToggleVisibility: (widgetId: string) => void;
  onMove: (widgetId: string, direction: 'up' | 'down') => void;
  dashboardData: ClubDashboardData | null;
}

const DashboardWidgetWrapper = ({
  widget,
  editMode,
  onToggleVisibility,
  onMove,
  dashboardData,
}: WidgetWrapperProps) => {
  const getWidgetTitle = () => {
    switch (widget.type) {
      case 'live_ticker':
        return '📡 Live Activity';
      case 'hall_of_fame':
        return '🏆 명예의 전당';
      case 'daily_squad':
        return '👥 오늘의 스쿼드';
      case 'leaderboard':
        const metricType = widget.config?.metricType;
        if (metricType === 'cardio') return '🏃 유산소 킹';
        if (metricType === 'strength') return '🏋️ 스트렝스 킹';
        if (metricType === 'snowboard') return '🏂 슬로프 킹';
        return '리더보드';
      default:
        return '위젯';
    }
  };

  const renderWidget = () => {
    if (!dashboardData) return <div>로딩 중...</div>;

    switch (widget.type) {
      case 'live_ticker':
        return <LiveTicker badges={dashboardData.badges} squad={dashboardData.squad} />;
      case 'hall_of_fame':
        return <HallOfFame badges={dashboardData.badges} />;
      case 'daily_squad':
        return <DailySquad squad={dashboardData.squad} />;
      case 'leaderboard':
        const metricType = widget.config?.metricType as 'cardio' | 'strength' | 'snowboard';
        let title = '';
        let subtitle = '';
        if (metricType === 'cardio') {
          title = '🏃 유산소 킹';
          subtitle = '환산 거리 기준 (🏃×1.0 🪜×1.0 🚣×0.6 🚴×0.4 💨×0.3)';
        } else if (metricType === 'strength') {
          title = '🏋️ 스트렝스 킹';
          subtitle = '총 볼륨 기준';
        } else if (metricType === 'snowboard') {
          title = '🏂 슬로프 킹';
          subtitle = '런 수 기준';
        }
        return (
          <LeaderboardSection
            title={title}
            subtitle={subtitle}
            rankings={dashboardData.leaderboards[metricType]}
            metricType={metricType}
          />
        );
      default:
        return null;
    }
  };

  if (!widget.visible && !editMode) {
    return null;
  }

  return (
    <div
      style={{
        position: 'relative',
        opacity: widget.visible ? 1 : 0.5,
        border: editMode ? '2px dashed var(--primary-color)' : 'none',
        borderRadius: editMode ? '12px' : '0',
        padding: editMode ? '8px' : '0',
      }}
    >
      {/* Edit Mode Controls */}
      {editMode && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            gap: '8px',
            zIndex: 10,
            background: 'var(--bg-secondary)',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => onMove(widget.id, 'up')}
            style={{
              padding: '4px 12px',
              fontSize: '14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
            title="위로 이동"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(widget.id, 'down')}
            style={{
              padding: '4px 12px',
              fontSize: '14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
            title="아래로 이동"
          >
            ↓
          </button>
          <button
            onClick={() => onToggleVisibility(widget.id)}
            style={{
              padding: '4px 12px',
              fontSize: '14px',
              background: widget.visible ? 'var(--primary-color)' : 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: widget.visible ? 'white' : 'var(--text-primary)',
              fontWeight: '600',
            }}
            title={widget.visible ? '숨기기' : '표시'}
          >
            {widget.visible ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      )}

      {/* Widget Label in Edit Mode */}
      {editMode && (
        <div
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--primary-color)',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          {getWidgetTitle()}
        </div>
      )}

      {/* Widget Content */}
      {renderWidget()}
    </div>
  );
};

// ============================================
// Gamified Dashboard Components
// ============================================

// Live Ticker - 실시간 활동 피드 (뉴스 티커 스타일)
const LiveTicker = ({ badges, squad }: { badges: Array<any>; squad: Array<any> }) => {
  // 간단한 티커 아이템 생성 (배지 + 스쿼드 활동)
  const tickerItems = useMemo(() => {
    const items: Array<{ id: string; icon: string; text: string; timestamp: number }> = [];

    // 배지 티커 (최근 3개)
    badges.slice(0, 3).forEach((badge, index) => {
      items.push({
        id: `badge-${badge.userId}-${badge.title}-${index}`,
        icon: badge.icon,
        text: `${badge.userName}님이 ${badge.title} 배지 획득!`,
        timestamp: Date.now(),
      });
    });

    // 스쿼드 티커 (최근 5명)
    squad.slice(0, 5).forEach((member) => {
      items.push({
        id: `squad-${member.userId}`,
        icon: member.activityType === 'today' ? '🔥' : '⚡',
        text: `${member.displayName}님이 ${member.mainActivity} 완료!`,
        timestamp: Date.now(),
      });
    });

    return items;
  }, [badges, squad]);

  if (tickerItems.length === 0) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '2px solid #334155',
        borderRadius: '12px',
        padding: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '20px' }}>📡</div>
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>LIVE ACTIVITY</h3>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {tickerItems.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              fontSize: '14px',
              borderLeft: '3px solid var(--primary-color)',
            }}
          >
            <div style={{ fontSize: '18px' }}>{item.icon}</div>
            <div style={{ flex: 1, color: '#e2e8f0' }}>{item.text}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {new Date(item.timestamp).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// Hall of Fame Carousel - 배지 시스템
const HallOfFame = ({ badges }: { badges: Array<any> }) => {

  // Mouse drag scroll for desktop
  const carouselRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeft.current = carouselRef.current.scrollLeft;
    carouselRef.current.style.cursor = 'grabbing';
    carouselRef.current.style.userSelect = 'none';
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    if (carouselRef.current) {
      carouselRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (carouselRef.current) {
      carouselRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; // Scroll speed multiplier
    carouselRef.current.scrollLeft = scrollLeft.current - walk;
  };

  if (badges.length === 0) {
    return (
      <div className="section">
        <h3>🏆 명예의 전당</h3>
        <div className="empty-state">
          <p>아직 배지를 획득한 멤버가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 배지 타입별 색상 매핑
  const getBadgeColor = (type: HofBadge['type']): string => {
    switch (type) {
      case 'strength':
        return '#ef4444'; // Red
      case 'cardio':
        return '#3b82f6'; // Blue
      case 'effort':
        return '#eab308'; // Yellow
      case 'time':
        return '#f97316'; // Orange
      case 'consistency':
        return '#8b5cf6'; // Purple
      default:
        return '#64748b'; // Gray
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '2px solid #334155',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0', marginBottom: '4px' }}>
          🏆 명예의 전당
        </h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
          주간 베스트 멤버 {badges.length}명
        </p>
        <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
          💡 유산소: 종목별 환산 (🏃×1.0 🪜×1.0 🚣×0.6 🚴×0.4 💨×0.3)
        </p>
      </div>

      {/* Carousel Container with Snap Scroll */}
      <div
        ref={carouselRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '8px',
          cursor: 'grab',
          // Hide scrollbar but keep functionality
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="hall-of-fame-carousel"
      >
        {badges.map((badge, index) => {
          const color = getBadgeColor(badge.type);

          return (
            <div
              key={`${badge.userId}-${badge.title}-${index}`}
              style={{
                minWidth: '280px',
                maxWidth: '280px',
                scrollSnapAlign: 'start',
                background: badge.isMe
                  ? `linear-gradient(135deg, ${color}33 0%, ${color}22 100%)`
                  : `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`,
                border: badge.isMe ? `3px solid ${color}` : `2px solid ${color}66`,
                borderRadius: '16px',
                padding: '20px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: badge.isMe ? `0 0 20px ${color}44` : 'none',
              }}
            >
              {/* Me Badge (나만 표시) */}
              {badge.isMe && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: color,
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ⭐ ME
                </div>
              )}

              {/* Badge Icon (우측 상단) */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  fontSize: '32px',
                  opacity: 0.3,
                }}
              >
                {badge.icon}
              </div>

              {/* Profile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                {badge.userProfile ? (
                  <img
                    src={badge.userProfile}
                    alt={badge.userName}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `3px solid ${color}`,
                    }}
                  />
                ) : (
                  <div
                    className="profile-avatar"
                    style={{
                      width: '56px',
                      height: '56px',
                      fontSize: '24px',
                      border: `3px solid ${color}`,
                    }}
                  >
                    {badge.userName[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0' }}>
                    {badge.userName}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: color,
                      fontWeight: '600',
                      marginTop: '4px',
                    }}
                  >
                    {badge.icon} {badge.title}
                  </div>
                </div>
              </div>

              {/* Achievement Value */}
              <div style={{ marginTop: '16px' }}>
                <div
                  style={{
                    fontSize: '36px',
                    fontWeight: '700',
                    color: color,
                    marginBottom: '6px',
                    lineHeight: 1,
                  }}
                >
                  {badge.value}
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {badge.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll Hint (첫 번째 카드가 Me가 아닐 때만 표시) */}
      {badges.length > 1 && !badges[0].isMe && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          ← 좌우로 스크롤하여 더 많은 배지를 확인하세요 →
        </div>
      )}
    </div>
  );
};

// Smart Active Squad - 오늘 + 어제 운동한 멤버 표시
const DailySquad = ({ squad }: { squad: Array<any> }) => {

  if (squad.length === 0) {
    return (
      <div className="section">
        <h3>👥 Active Squad</h3>
        <div className="empty-state">
          <p>최근 활동한 멤버가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 통계 계산
  const todayCount = squad.filter((m) => m.activityType === 'today').length;
  const yesterdayCount = squad.filter((m) => m.activityType === 'yesterday').length;

  const getSubtitle = () => {
    if (todayCount > 0 && yesterdayCount > 0) {
      return `오늘 ${todayCount}명, 어제 ${yesterdayCount}명이 운동했습니다`;
    } else if (todayCount > 0) {
      return `${todayCount}명이 오늘 운동했습니다`;
    } else if (yesterdayCount > 0) {
      return `${yesterdayCount}명이 어제 운동했습니다`;
    } else {
      return `${squad.length}명의 활성 멤버`;
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '2px solid #334155',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0', marginBottom: '4px' }}>
          👥 Active Squad
        </h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>{getSubtitle()}</p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {squad.map((member) => {
          // activityType에 따른 스타일 결정
          const isToday = member.activityType === 'today';
          const isYesterday = member.activityType === 'yesterday';

          const cardStyle = {
            minWidth: '160px',
            background: isToday
              ? 'rgba(139, 92, 246, 0.15)' // Today: 보라색 배경
              : isYesterday
              ? 'rgba(255, 255, 255, 0.05)' // Yesterday: 기본 배경
              : 'rgba(71, 85, 105, 0.3)', // Recent: 회색조
            border: isToday
              ? '2px solid #8b5cf6' // Today: 보라색 테두리
              : isYesterday
              ? '2px dashed #64748b' // Yesterday: 점선 회색 테두리
              : '2px solid #475569',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center' as const,
            position: 'relative' as const,
            opacity: isToday ? 1 : isYesterday ? 0.85 : 0.7,
          };

          const getBadge = () => {
            if (isToday) {
              return (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    background: '#8b5cf6',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  🔥 Today
                </div>
              );
            } else if (isYesterday) {
              return (
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    background: '#64748b',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  ⚡ Yesterday
                </div>
              );
            }
            return null;
          };

          return (
            <div key={member.userId} style={cardStyle}>
              {/* Period Badge */}
              {getBadge()}

              {/* Activity Icon Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  fontSize: '20px',
                }}
              >
                {member.mainActivity}
              </div>

              {/* Profile */}
              {member.profileImage ? (
                <img
                  src={member.profileImage}
                  alt={member.displayName}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    marginBottom: '12px',
                    border: isToday ? '3px solid #8b5cf6' : '2px solid #64748b',
                  }}
                />
              ) : (
                <div
                  className="profile-avatar"
                  style={{
                    width: '64px',
                    height: '64px',
                    fontSize: '28px',
                    margin: '0 auto 12px',
                    border: isToday ? '3px solid #8b5cf6' : '2px solid #64748b',
                  }}
                >
                  {member.displayName[0]}
                </div>
              )}

              {/* Name */}
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#e2e8f0',
                  marginBottom: '8px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {member.displayName}
              </div>

              {/* Workout Count */}
              <div
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginBottom: '8px',
                }}
              >
                {member.workoutCount}개 운동
              </div>

              {/* Memo Speech Bubble */}
              {member.memo && (
                <div
                  style={{
                    background: isToday ? 'rgba(139, 92, 246, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                    border: isToday ? '1px solid #8b5cf6' : '1px solid #64748b',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '12px',
                    color: isToday ? '#c4b5fd' : '#94a3b8',
                    marginTop: '8px',
                    lineHeight: '1.4',
                    maxHeight: '60px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  💬 {member.memo}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Leaderboard Section Component
const LeaderboardSection = ({
  title,
  subtitle,
  rankings,
  metricType,
}: {
  title: string;
  subtitle: string;
  rankings: Array<{ userId: string; displayName: string; profileImage: string | null; value: number }>;
  metricType: 'cardio' | 'strength' | 'snowboard';
}) => {

  if (rankings.length === 0) {
    return (
      <div className="section">
        <h3>{title}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{subtitle}</p>
        <div className="empty-state">
          <p>아직 기록이 없습니다.</p>
        </div>
      </div>
    );
  }

  const formatValue = (value: number): string => {
    switch (metricType) {
      case 'cardio':
        return formatMetric(value, 'distance');
      case 'strength':
        return formatMetric(value, 'volume');
      case 'snowboard':
        return formatMetric(value, 'count');
      default:
        return String(value);
    }
  };

  return (
    <div className="section">
      <h3>{title}</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        {subtitle}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rankings.map((user, index) => (
          <div
            key={user.userId}
            className="log-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: index < 3 ? 'var(--highlight-bg)' : undefined,
            }}
          >
            {/* 순위 */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: '700',
                width: '30px',
                textAlign: 'center',
                color:
                  index === 0
                    ? '#FFD700'
                    : index === 1
                    ? '#C0C0C0'
                    : index === 2
                    ? '#CD7F32'
                    : 'var(--text-secondary)',
              }}
            >
              {index + 1}
            </div>

            {/* 프로필 */}
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.displayName}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                className="profile-avatar"
                style={{ width: '40px', height: '40px', fontSize: '16px' }}
              >
                {user.displayName[0]}
              </div>
            )}

            {/* 이름 */}
            <div style={{ flex: 1, fontSize: '16px', fontWeight: '600' }}>
              {user.displayName}
            </div>

            {/* 점수 */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--primary-color)',
              }}
            >
              {formatValue(user.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
