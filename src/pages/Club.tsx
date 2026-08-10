import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import teamMatchService from '../services/teamMatchService';
import { getExpressions } from '../utils/mileageExpressions';
import { CreateClubModal } from '../components/CreateClubModal';
import { MileageConfigModal } from '../components/MileageConfigModal';
import { ClubDetailedStatsModal } from '../components/ClubDetailedStatsModal';
import { WorkoutFeed } from '../components/WorkoutFeed';
import { ClubMemberDetailModal } from '../components/ClubMemberDetailModal';
import type { MyClubWithOrder, ClubRanking, ClubDetailedStats } from '../services/clubService';
import type { WorkoutFeedItem } from '../services/feedService';
import { ClubChallengeSection } from '../components/ClubChallengeSection';
import { ChallengeCreateModal } from '../components/ChallengeCreateModal';
import { TeamAssignModal } from '../components/TeamAssignModal';
import { ChallengeArchiveModal } from '../components/ChallengeArchiveModal';
import { useModalHistory } from '../hooks/useModalHistory';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info, Table, Users, User, RefreshCw, UserRoundPlus, Settings, Search, X, Trophy, Clock, Plus, Lock, Image, Filter } from 'lucide-react';
import { arrayMove } from '@dnd-kit/sortable';

// 순서 변경 버튼이 있는 클럽 아이템
function ClubOrderItem({ club, isSelected, isFirst, isLast, onSelect, onMoveUp, onMoveDown }: {
  club: MyClubWithOrder;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className={`sortable-club-item ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="order-buttons" onClick={e => e.stopPropagation()}>
        <button className="order-btn" onClick={onMoveUp} disabled={isFirst} aria-label="위로">▲</button>
        <button className="order-btn" onClick={onMoveDown} disabled={isLast} aria-label="아래로">▼</button>
      </div>
      {club.logo_url ? (
        <div className="club-item-logo">
          <img src={club.logo_url} alt={club.name} />
        </div>
      ) : (
        <div className="club-item-logo-placeholder">
          {club.name[0]}
        </div>
      )}
      <div className="club-item-content">
        <div className="club-item-name">
          {club.name}
          {club.status === 'pending' && (
            <span className="club-pending-badge">승인대기</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const Club = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [myClubs, setMyClubs] = useState<MyClubWithOrder[]>([]);
  const [selectedClub, setSelectedClub] = useState<MyClubWithOrder | null>(null);
  const [ranking, setRanking] = useState<ClubRanking[]>([]);
  const [loading, setLoading] = useState(true); // 초기 로딩 true로 설정
  const [rankingLoading, setRankingLoading] = useState(false); // 랭킹 로딩 별도 관리
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMileageConfig, setShowMileageConfig] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showCategoryFilterMenu, setShowCategoryFilterMenu] = useState(false);
  const [showClubMenu, setShowClubMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  useModalHistory(showClubMenu, () => setShowClubMenu(false));
  useModalHistory(showInviteModal, () => setShowInviteModal(false));
  const [challengeMenuOpen, setChallengeMenuOpen] = useState(false);
  const [showChallengeCreate, setShowChallengeCreate] = useState(false);
  const [showChallengeArchive, setShowChallengeArchive] = useState(false);
  const [challengeRefreshKey, setChallengeRefreshKey] = useState(0);
  const [assignInfo, setAssignInfo] = useState<{ id: string; startDate: string; baselineMonths: number } | null>(null);
  const [teamBadges, setTeamBadges] = useState<Record<string, { color: string; name: string }>>({});
  const [showLockTooltip, setShowLockTooltip] = useState(false);

  // 멤버 상세 모달
  const [selectedMember, setSelectedMember] = useState<{
    userId: string;
    userName: string;
    year: number;
    month: number;
  } | null>(null);

  // 피드 관련 state
  type TabType = 'ranking' | 'feed' | 'social';
  const [activeTab, setActiveTab] = useState<TabType>((location.state as { tab?: TabType } | null)?.tab ?? 'feed');

  // 마일리지 표현 state
  const [mileageExpressions, setMileageExpressions] = useState(() => getExpressions(0, 1));

const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [feedItems, setFeedItems] = useState<WorkoutFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  // 활성화된 카테고리 (club_mileage_configs.enabled=true)
  const [enabledCategorySet, setEnabledCategorySet] = useState<Set<string>>(new Set());

  // 피드 캐시: { clubId-dateString: WorkoutFeedItem[] }
  const [feedCache, setFeedCache] = useState<Record<string, WorkoutFeedItem[]>>({});

  // 랭킹 필터 state
  type RankingTab = 'myrank' | 'all';
  const [rankingTab, setRankingTab] = useState<RankingTab>('myrank');
  const [showHof, setShowHof] = useState(false);
  const [hideHof, setHideHof] = useState(false);
  const [rookieOnly, setRookieOnly] = useState(false);
  const rankingRequestId = useRef(0);

  // 종목별 마일리지 필터 (null = 전체 종목 합산). 값은 상위 카테고리명 — 하위분류(러닝/트레드밀 등)는
  // 칩 하나로 합쳐서 보여주고 필터 시 그 카테고리의 모든 하위분류 마일리지를 합산한다.
  const [mileageCategoryFilter, setMileageCategoryFilter] = useState<string | null>(null);
  const [mileageCategoryOptions, setMileageCategoryOptions] = useState<
    { category: string; keys: string[] }[]
  >([]);
  const [categoryStats, setCategoryStats] = useState<ClubDetailedStats[] | null>(null);
  const [categoryStatsLoading, setCategoryStatsLoading] = useState(false);
  const categoryStatsRequestId = useRef(0);
  const categoryStatsKeyRef = useRef<string | null>(null); // 마지막으로 fetch 성공한 club-year-month
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  useModalHistory(showMemberSearch, () => setShowMemberSearch(false));
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [showFullList, setShowFullList] = useState(false);

  // 랭킹 월 선택 state
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  useModalHistory(showMonthPicker, () => setShowMonthPicker(false));
  const [monthPickerYear, setMonthPickerYear] = useState(selectedMonth.getFullYear());
  const [monthPickerMonth, setMonthPickerMonth] = useState(selectedMonth.getMonth() + 1);


  // 내 클럽 불러오기
  const loadMyClubs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await clubService.getMyClubs(user.id);
      setMyClubs(data);

      if (data.length > 0 && !selectedClub) {
        // localStorage에서 마지막 선택 클럽 확인
        const lastSelectedClubId = localStorage.getItem('lastSelectedClubId');
        let clubToSelect = data[0]; // 기본값: 첫 번째 클럽

        // 저장된 클럽 ID가 있고, 현재 클럽 목록에 존재하면 해당 클럽 선택
        if (lastSelectedClubId) {
          const savedClub = data.find((c) => c.id === lastSelectedClubId);
          if (savedClub) {
            clubToSelect = savedClub;
          }
        }

        setSelectedClub(clubToSelect);
        loadClubRanking(clubToSelect.id);
      }
    } catch (error) {
      console.error('내 클럽 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 클럽 랭킹 불러오기
  const loadClubRanking = async (clubId: string, month?: Date) => {
    const requestId = ++rankingRequestId.current;
    setRankingLoading(true);
    try {
      const targetMonth = month || selectedMonth;
      const data = await clubService.getClubRanking(clubId, {
        year: targetMonth.getFullYear(),
        month: targetMonth.getMonth() + 1,
      });
      if (requestId !== rankingRequestId.current) return; // 구버전 응답 무시
      setRanking(data);
      const total = data.reduce((s: number, m: any) => s + m.total_mileage, 0);
      if (total >= 10) setMileageExpressions(getExpressions(total, 1));
      // 진행 중 팀 대항전 뱃지 (없으면 빈 객체)
      teamMatchService.getActiveTeamBadges(clubId)
        .then((b) => { if (requestId === rankingRequestId.current) setTeamBadges(b); })
        .catch(() => {});
    } catch (error) {
      if (requestId !== rankingRequestId.current) return;
      console.error('랭킹 불러오기 실패:', error);
    } finally {
      if (requestId === rankingRequestId.current) setRankingLoading(false);
    }
  };

  // 월 이동
  const handlePrevMonth = () => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setSelectedMonth(newMonth);
    if (selectedClub) {
      loadClubRanking(selectedClub.id, newMonth);
    }
  };

  const handleNextMonth = () => {
    const now = new Date();
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);

    // 미래 월은 불가
    if (newMonth > now) return;

    setSelectedMonth(newMonth);
    if (selectedClub) {
      loadClubRanking(selectedClub.id, newMonth);
    }
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return selectedMonth.getFullYear() === now.getFullYear() &&
           selectedMonth.getMonth() === now.getMonth();
  };

  const openMonthPicker = () => {
    setMonthPickerYear(selectedMonth.getFullYear());
    setMonthPickerMonth(selectedMonth.getMonth() + 1);
    setShowMonthPicker(true);
  };

  const applyMonthSelection = (year: number, month: number) => {
    const nextMonth = new Date(year, month - 1, 1);
    setSelectedMonth(nextMonth);
    setShowMonthPicker(false);
    if (selectedClub) {
      loadClubRanking(selectedClub.id, nextMonth);
    }
  };

  const openMemberDetail = (userId: string, userName: string) => {
    setSelectedMember({
      userId,
      userName,
      year: selectedMonth.getFullYear(),
      month: selectedMonth.getMonth() + 1,
    });
  };

  // 피드 로드 (캐싱 적용)
  const loadFeed = async (clubId: string, date: Date, forceReload = false) => {
    if (!user) return;

    const cacheKey = `${clubId}-${date.toDateString()}`;

    // 캐시 확인 (강제 새로고침이 아닐 때)
    if (!forceReload && feedCache[cacheKey]) {
      console.log('📦 캐시에서 피드 로드:', cacheKey);
      setFeedItems(feedCache[cacheKey]);
      return;
    }

    console.log('🔄 서버에서 피드 로드:', cacheKey);
    setFeedLoading(true);
    try {
      const items = await clubService.getClubWorkoutFeed(clubId, date, user.id);

      setFeedItems(items);

      // 캐시에는 is_disabled 없이 원본 저장
      setFeedCache(prev => ({
        ...prev,
        [cacheKey]: items,
      }));
    } catch (error) {
      console.error('피드 로드 실패:', error);
    } finally {
      setFeedLoading(false);
    }
  };

  // 날짜 변경
  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Optimistic 좋아요 업데이트
  const handleOptimisticLike = (workoutId: string, isLiked: boolean) => {
    setFeedItems(prev => prev.map(item =>
      item.workout.id === workoutId
        ? {
            ...item,
            like_count: isLiked ? item.like_count - 1 : item.like_count + 1,
            is_liked_by_me: !isLiked,
          }
        : item
    ));

    // 캐시도 업데이트
    const cacheKey = `${selectedClub?.id}-${selectedDate.toDateString()}`;
    if (feedCache[cacheKey]) {
      setFeedCache(prev => ({
        ...prev,
        [cacheKey]: prev[cacheKey].map(item =>
          item.workout.id === workoutId
            ? {
                ...item,
                like_count: isLiked ? item.like_count - 1 : item.like_count + 1,
                is_liked_by_me: !isLiked,
              }
            : item
        ),
      }));
    }
  };

  // Optimistic 댓글 추가 업데이트
  const handleOptimisticCommentAdd = (workoutId: string) => {
    setFeedItems(prev => prev.map(item =>
      item.workout.id === workoutId
        ? { ...item, comment_count: item.comment_count + 1 }
        : item
    ));

    // 캐시도 업데이트
    const cacheKey = `${selectedClub?.id}-${selectedDate.toDateString()}`;
    if (feedCache[cacheKey]) {
      setFeedCache(prev => ({
        ...prev,
        [cacheKey]: prev[cacheKey].map(item =>
          item.workout.id === workoutId
            ? { ...item, comment_count: item.comment_count + 1 }
            : item
        ),
      }));
    }
  };

  // Optimistic 댓글 삭제 업데이트
  const handleOptimisticCommentDelete = (workoutId: string) => {
    setFeedItems(prev => prev.map(item =>
      item.workout.id === workoutId
        ? { ...item, comment_count: Math.max(0, item.comment_count - 1) }
        : item
    ));

    // 캐시도 업데이트
    const cacheKey = `${selectedClub?.id}-${selectedDate.toDateString()}`;
    if (feedCache[cacheKey]) {
      setFeedCache(prev => ({
        ...prev,
        [cacheKey]: prev[cacheKey].map(item =>
          item.workout.id === workoutId
            ? { ...item, comment_count: Math.max(0, item.comment_count - 1) }
            : item
        ),
      }));
    }
  };

  // 차단 처리: 해당 유저의 게시물을 피드 state + 캐시에서 즉시 제거
  const handleBlock = (blockedUserId: string) => {
    setFeedItems(prev => prev.filter(item => item.workout.user_id !== blockedUserId));
    setFeedCache(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        updated[key] = updated[key].filter(item => item.workout.user_id !== blockedUserId);
      });
      return updated;
    });
  };

  useEffect(() => {
    loadMyClubs();
  }, [user]);

  useEffect(() => {
    if (showMemberSearch) {
      document.body.classList.add('search-modal-open');
    } else {
      document.body.classList.remove('search-modal-open');
    }
    return () => document.body.classList.remove('search-modal-open');
  }, [showMemberSearch]);

  // 페이지가 다시 보일 때 랭킹 새로고침 (뒤로가기 대응)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedClub) {
        loadClubRanking(selectedClub.id, selectedMonth);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedClub, selectedMonth]);

  // 클럽 변경 시 활성화 카테고리 로드 (피드 비활성 뱃지 + 종목별 마일리지 필터 옵션)
  useEffect(() => {
    if (!selectedClub) return;
    clubService.getClubMileageConfigs(selectedClub.id).then((rows) => {
      const enabledRows = rows.filter((r) => r.enabled);
      const keys = new Set(
        enabledRows.map((r) => (r.sub_type ? `${r.category}-${r.sub_type}` : r.category))
      );
      setEnabledCategorySet(keys);

      // 하위분류(러닝/트레드밀 등)를 상위 카테고리 하나로 합쳐서 칩 개수를 줄인다.
      const byCategory = new Map<string, string[]>();
      enabledRows.forEach((r) => {
        const key = r.sub_type ? `${r.category}-${r.sub_type}` : r.category;
        if (!byCategory.has(r.category)) byCategory.set(r.category, []);
        byCategory.get(r.category)!.push(key);
      });
      // 클럽 관리자가 필터 칩에 노출할 카테고리를 직접 골라둔 경우 그 목록만 노출 (null = 전체)
      const whitelist = selectedClub.mileage_filter_categories;
      setMileageCategoryOptions(
        [...byCategory.entries()]
          .filter(([category]) => !whitelist || whitelist.includes(category))
          .map(([category, catKeys]) => ({ category, keys: catKeys }))
          .sort((a, b) => a.category.localeCompare(b.category))
      );
    });
    // 클럽이 바뀌면 이전 클럽의 종목 필터·캐시는 무효
    setMileageCategoryFilter(null);
    setCategoryStats(null);
    categoryStatsKeyRef.current = null;
  }, [selectedClub?.id]);

  // 종목별 마일리지 필터가 선택되면 클럽 상세 통계(종목별 마일리지)를 조회
  // (월이 바뀌면 캐시 키가 달라져 자동 재조회됨)
  useEffect(() => {
    if (!selectedClub || !mileageCategoryFilter) return;
    const key = `${selectedClub.id}-${selectedMonth.getFullYear()}-${selectedMonth.getMonth() + 1}`;
    if (categoryStatsKeyRef.current === key) return;

    const requestId = ++categoryStatsRequestId.current;
    setCategoryStatsLoading(true);
    clubService
      .getClubDetailedStats(selectedClub.id, {
        year: selectedMonth.getFullYear(),
        month: selectedMonth.getMonth() + 1,
      })
      .then((data) => {
        if (requestId !== categoryStatsRequestId.current) return;
        setCategoryStats(data);
        categoryStatsKeyRef.current = key;
      })
      .catch((error) => {
        if (requestId !== categoryStatsRequestId.current) return;
        console.error('[클럽 마일리지] 종목별 통계 조회 실패 상세:', JSON.stringify(error), error);
      })
      .finally(() => {
        if (requestId === categoryStatsRequestId.current) setCategoryStatsLoading(false);
      });
  }, [selectedClub?.id, selectedMonth, mileageCategoryFilter]);

  // 마일리지 탭 잠금 기간에 ranking 탭이 활성이면 feed로 초기 전환
  useEffect(() => {
    if (!selectedClub) return;
    const isAdmin = selectedClub.role === 'manager' || selectedClub.role === 'vice-manager';
    if (isAdmin) return; // 운영진은 잠금 기간에도 자유롭게 이동
    const today = new Date().getDate();
    const periods = selectedClub.mileage_hide_periods || [];
    if (periods.some(p => today >= p.from && today <= p.to)) {
      setActiveTab('feed');
    }
  }, [selectedClub?.id]);


  // 피드 탭 활성화 시 피드 로드
  useEffect(() => {
    if (activeTab === 'feed' && selectedClub) {
      loadFeed(selectedClub.id, selectedDate);
    }
  }, [activeTab, selectedClub, selectedDate]);

  // 클럽 선택
  const handleSelectClub = async (club: MyClubWithOrder) => {
    setSelectedClub(club);
    setShowDropdown(false);
    loadClubRanking(club.id);

    // localStorage에 선택한 클럽 저장
    localStorage.setItem('lastSelectedClubId', club.id);
  };

  // ▲▼ 버튼으로 순서 변경
  const handleMoveClub = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= myClubs.length) return;

    const newOrder = arrayMove(myClubs, index, targetIndex);
    setMyClubs(newOrder);

    try {
      const clubOrders = newOrder.map((club, i) => ({ club_id: club.id, order: i }));
      await clubService.updateClubOrder(user!.id, clubOrders);
    } catch (error) {
      console.error('순서 변경 실패:', error);
      loadMyClubs();
    }
  };

  // 카카오톡으로 클럽 초대 공유
  const handleKakaoInviteShare = () => {
    if (!selectedClub) return;

    if (!window.Kakao || !window.Kakao.isInitialized()) {
      alert('카카오톡 공유 기능을 사용할 수 없습니다.');
      return;
    }

    const inviteUrl = `${window.location.origin}/join/${selectedClub.invite_code}`;

    console.log('🔗 생성된 초대 URL:', inviteUrl);
    console.log('📋 초대 코드:', selectedClub.invite_code);

    try {
      const shareData: any = {
        objectType: 'feed',
        content: {
          title: `🏃 ${selectedClub.name} 클럽 초대`,
          description: `${selectedClub.name} 클럽에 초대합니다!\n함께 운동하며 건강한 습관을 만들어봐요 💪`,
          link: {
            mobileWebUrl: inviteUrl,
            webUrl: inviteUrl,
          },
        },
        buttons: [
          {
            title: '클럽 가입하기',
            link: {
              mobileWebUrl: inviteUrl,
              webUrl: inviteUrl,
            },
          },
        ],
      };

      // imageUrl은 존재할 때만 추가
      if (selectedClub.logo_url) {
        shareData.content.imageUrl = selectedClub.logo_url;
      }

      console.log('카카오 클럽 초대 공유 데이터:', shareData);
      window.Kakao.Share.sendDefault(shareData);
      setShowInviteModal(false);
    } catch (error) {
      console.error('카카오톡 공유 실패:', error);
      alert('카카오톡 공유에 실패했습니다.');
    }
  };

  // 초대 링크 복사
  const handleCopyInviteLink = () => {
    if (!selectedClub) return;

    const inviteUrl = `${window.location.origin}/join/${selectedClub.invite_code}`;
    const copyText = `${selectedClub.name} 클럽으로 초대합니다.\n${inviteUrl}`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(copyText).then(() => {
        alert('초대 메시지가 복사되었습니다! 📋');
        setShowInviteModal(false);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = copyText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('초대 메시지가 복사되었습니다! 📋');
      setShowInviteModal(false);
    }
  };

  return (
    <div className="container">
      {/* 클럽이 없을 때 안내 */}
      {!loading && myClubs.length === 0 && (
        <div className="empty-state" style={{ marginTop: '60px', marginBottom: '60px' }}>
          <p style={{ fontSize: '16px', marginBottom: '12px' }}>아직 가입한 클럽이 없습니다</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            상단 우측의 + 버튼을 눌러 시작해보세요!
          </p>
        </div>
      )}

      {/* 클럽 드롭다운과 액션 버튼 */}
      {myClubs.length > 0 && (
        <div className="club-header-container">
          <div className="club-dropdown-container compact">
          <button
            className="club-dropdown-trigger"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {selectedClub?.logo_url ? (
              <div className="dropdown-trigger-logo">
                <img src={selectedClub.logo_url} alt={selectedClub.name} />
              </div>
            ) : (
              <div className="dropdown-trigger-logo-placeholder">
                {selectedClub?.name[0] || '?'}
              </div>
            )}
            <div className="dropdown-trigger-content">
              <div className="dropdown-trigger-name">{selectedClub?.name || '클럽 선택'}</div>
            </div>
            <span className="dropdown-arrow">
              {showDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showDropdown && (
            <div className="club-dropdown-menu">
              <div className="dropdown-header">
                내 클럽 ({myClubs.length})
                <button
                  className="dropdown-close"
                  onClick={() => setShowDropdown(false)}
                >
                  ✕
                </button>
              </div>

              <div className="sortable-club-list">
                {myClubs.map((club, index) => (
                  <ClubOrderItem
                    key={club.id}
                    club={club}
                    isSelected={selectedClub?.id === club.id}
                    isFirst={index === 0}
                    isLast={index === myClubs.length - 1}
                    onSelect={() => handleSelectClub(club)}
                    onMoveUp={() => handleMoveClub(index, 'up')}
                    onMoveDown={() => handleMoveClub(index, 'down')}
                  />
                ))}
              </div>

              <div className="dropdown-footer">
                ▲▼ 버튼으로 순서 변경
              </div>
            </div>
          )}
          </div>

          {/* 클럽 액션 아이콘 버튼 */}
          {selectedClub && (
            <div className="club-action-icons">
              <button
                className="club-icon-button"
                onClick={() => setShowInviteModal(true)}
                title="클럽 초대"
              >
                <UserRoundPlus size={20} />
              </button>
              <button
                className="club-icon-button"
                onClick={() => setShowClubMenu(true)}
                title="클럽 설정"
              >
                <Settings size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 챌린지 섹션 */}
      {selectedClub && user && (
        <ClubChallengeSection
          key={challengeRefreshKey}
          club={selectedClub}
          userId={user.id}
          isManager={selectedClub.role === 'manager' || selectedClub.role === 'vice-manager'}
          onReassignTeams={(c) => setAssignInfo({
            id: c.id,
            startDate: c.start_date,
            baselineMonths: c.meta_data?.team_match?.baseline_months ?? 3,
          })}
        />
      )}

      {/* 탭 */}
      {selectedClub && (() => {
        const isAdmin = selectedClub.role === 'manager' || selectedClub.role === 'vice-manager';
        const today = new Date().getDate();
        const periods = selectedClub.mileage_hide_periods || [];
        const activePeriods = periods.filter(p => today >= p.from && today <= p.to);
        const isLockPeriod = activePeriods.length > 0; // 잠금 기간 여부 (역할 무관)
        const isMileageBlocked = isLockPeriod && !isAdmin; // 일반회원만 실제 차단
        return (
          <>
          {isMileageBlocked && showLockTooltip && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setShowLockTooltip(false)}
            />
          )}
          <div className="tabs">
            <div style={{ position: 'relative', flex: 1 }}>
              <button
                className={`tab ${activeTab === 'ranking' ? 'active' : ''}${isLockPeriod ? ' tab--locked' : ''}`}
                onClick={() => isMileageBlocked ? setShowLockTooltip(v => !v) : setActiveTab('ranking')}
                style={isMileageBlocked ? { cursor: 'pointer', opacity: 0.5, width: '100%' } : { width: '100%' }}
              >
                마일리지{isLockPeriod && <Lock size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />}
              </button>
              {isMileageBlocked && showLockTooltip && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                  borderRadius: '10px', padding: '8px 12px', whiteSpace: 'nowrap',
                  fontSize: '13px', color: 'var(--text-primary)', zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderBottom: 'none', borderRight: 'none', rotate: '45deg' }} />
                  🔒 잠금기간
                  {activePeriods.map((p, i) => (
                    <span key={i} style={{ display: 'block', marginTop: 2, color: 'var(--text-secondary)' }}>
                      매월 {p.from}일 ~ {p.to}일
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`tab ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              오늘의 운동
            </button>
          </div>
          </>
        );
      })()}

      {/* 마일리지 랭킹 */}
      {activeTab === 'ranking' && (
        loading ? (
          <div className="loading-screen">
            <div className="spinner"></div>
            <p>클럽 불러오는 중...</p>
          </div>
        ) : selectedClub ? (
        <div className="club-dashboard">
          <div className="dashboard-header">
            <div className="month-selector">
              <button
                className="month-nav-button"
                onClick={handlePrevMonth}
                title="이전 달"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="month-selector-label"
                onClick={openMonthPicker}
                title="월/연도 선택"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  font: 'inherit',
                  padding: 0,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {selectedMonth.getFullYear()}년 {String(selectedMonth.getMonth() + 1).padStart(2, '0')}월
              </button>
              <button
                className="month-nav-button"
                onClick={handleNextMonth}
                disabled={isCurrentMonth()}
                title="다음 달"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="dashboard-header-actions">
              <button
                className="dashboard-action-button"
                onClick={() => setShowMileageConfig(true)}
                title="마일리지 계수 보기"
              >
                <Info size={16} />
              </button>
              <button
                className="dashboard-action-button"
                onClick={() => { setShowMemberSearch(true); setMemberSearchQuery(''); }}
                title="멤버 검색"
                style={highlightedUserId ? { color: '#FF6B9D', borderColor: '#FF6B9D' } : undefined}
              >
                <Search size={16} />
              </button>
              {highlightedUserId && (
                <button
                  className="dashboard-action-button"
                  onClick={() => { setHighlightedUserId(null); setShowFullList(false); }}
                  title="검색 초기화"
                  style={{ color: '#FF6B9D' }}
                >
                  <X size={16} />
                </button>
              )}
              <button
                className="dashboard-action-button"
                onClick={() => setShowDetailedStats(true)}
                title="상세 통계"
              >
                <Table size={16} />
              </button>
              {mileageCategoryOptions.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="dashboard-action-button"
                    onClick={() => setShowCategoryFilterMenu((v) => !v)}
                    title="종목 필터"
                    style={mileageCategoryFilter ? { color: '#FF6B9D', borderColor: '#FF6B9D' } : undefined}
                  >
                    <Filter size={16} />
                  </button>
                  {showCategoryFilterMenu && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                        onClick={() => setShowCategoryFilterMenu(false)}
                      />
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                        borderRadius: '10px', padding: '6px', minWidth: '140px',
                        zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}>
                        <button
                          type="button"
                          onClick={() => { setMileageCategoryFilter(null); setShowCategoryFilterMenu(false); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                            background: mileageCategoryFilter === null ? 'var(--input-bg)' : 'none',
                            border: 'none', borderRadius: '6px', cursor: 'pointer',
                            fontSize: '14px', fontWeight: mileageCategoryFilter === null ? 600 : 400,
                            color: 'var(--text-primary)',
                          }}
                        >
                          전체 종목
                        </button>
                        {mileageCategoryOptions.map((opt) => (
                          <button
                            key={opt.category}
                            type="button"
                            onClick={() => { setMileageCategoryFilter(opt.category); setShowCategoryFilterMenu(false); }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                              background: mileageCategoryFilter === opt.category ? 'var(--input-bg)' : 'none',
                              border: 'none', borderRadius: '6px', cursor: 'pointer',
                              fontSize: '14px', fontWeight: mileageCategoryFilter === opt.category ? 600 : 400,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {opt.category}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 클럽 합산 마일리지 게이지 */}
          {(() => {
            const totalMileage = ranking.reduce((s, m) => s + m.total_mileage, 0);
            if (totalMileage < 10) return null;
            const expr = mileageExpressions[0];
            if (!expr) return null;
            const r = expr.ratio;
            const unit = r < 10 ? 1 : 5;
            const nextMilestone = r < 1 ? 1 : Math.ceil(r / unit) * unit;
            const pct = Math.min((r / nextMilestone) * 100, 100);
            const milestoneKm = Math.round(nextMilestone * expr.km);
            return (
              <div className="mileage-gauge-banner">
                <div className="mileage-gauge-header">
                  <span className="mileage-gauge-total">이번 달 합산 <strong>{totalMileage.toFixed(0)}점</strong></span>
                  <button
                    className="mileage-gauge-shuffle"
                    onClick={() => setMileageExpressions(getExpressions(totalMileage, 1))}
                    title="다르게 보기"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
                <div className="mileage-gauge-row">
                  <span className="mileage-gauge-label">{expr.label} ({expr.km.toLocaleString()}km)</span>
                  <div className="mileage-gauge-track-wrap">
                    <div className="mileage-gauge-track">
                      <div className="mileage-gauge-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mileage-gauge-pct" style={{ color: pct > 55 ? 'white' : 'var(--text-secondary)' }}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="mileage-gauge-badge">
                    <span className="mileage-gauge-x">×{nextMilestone}</span>
                    <span className="mileage-gauge-km">{milestoneKm.toLocaleString()}km</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 랭킹 탭 */}
          <div className="ranking-filter-tabs">
            <button
              className={`filter-tab ${rankingTab === 'myrank' ? 'active' : ''}`}
              onClick={() => setRankingTab('myrank')}
            >
              내순위
            </button>
            <button
              className={`filter-tab ${rankingTab === 'all' ? 'active' : ''}`}
              onClick={() => setRankingTab('all')}
            >
              전체
            </button>
          </div>

          {rankingLoading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>랭킹 불러오는 중...</p>
            </div>
          ) : (() => {
            // 종목별 필터 선택 시 클럽 상세 통계(종목별 마일리지)로 소스 교체.
            // ranking 에 있는 유저로만 제한하는 이유: getClubDetailedStats 는 show_mileage=false
            // 로 랭킹을 숨긴 멤버까지 포함하므로, 그대로 쓰면 숨김 설정을 무시하고 노출된다.
            let source: ClubRanking[] = ranking;
            if (mileageCategoryFilter) {
              if (!categoryStats) {
                return (
                  <div className="loading-screen">
                    <div className="spinner"></div>
                    <p>{categoryStatsLoading ? '종목별 순위 불러오는 중...' : '종목별 순위 준비 중...'}</p>
                  </div>
                );
              }
              // 선택된 카테고리에 속한 하위분류(러닝/트레드밀 등) 전부의 마일리지를 합산
              const keys = mileageCategoryOptions.find(o => o.category === mileageCategoryFilter)?.keys
                ?? [mileageCategoryFilter];
              const rankingByUser = new Map(ranking.map(m => [m.user_id, m]));
              source = categoryStats
                .filter(s => rankingByUser.has(s.user_id))
                .map(s => {
                  const base = rankingByUser.get(s.user_id)!;
                  const mileage = keys.reduce((sum, k) => sum + (s.by_workout[k] || 0), 0);
                  return { ...base, total_mileage: mileage, workout_count: mileage > 0 ? 1 : 0 };
                });
            }

            // categoryStats 는 종목 합산 총점 기준으로 정렬되어 있어, 특정 종목만 골라낸 뒤에는
            // 그 정렬이 더 이상 유효하지 않다 (예: 종합 1위가 러닝은 안 해서 실제로는 하위권일 수 있음).
            // 순위(rank)는 배열 인덱스로 매기므로 여기서 항상 다시 정렬해야 함.
            const withRecord = source
              .filter(m => m.workout_count > 0 && m.total_mileage > 0)
              .sort((a, b) => b.total_mileage - a.total_mileage);

            // 필터 체크박스 적용
            let filtered = withRecord;
            if (hideHof) filtered = filtered.filter(m => !m.is_hall_of_fame);
            if (rookieOnly) filtered = filtered.filter(m => m.is_rookie);

            // 필터 적용 후 순위 재계산
            const reranked = filtered.map((m, i) => ({ ...m, rank: i + 1 }));

            // 내 순위 찾기
            const myEntry = reranked.find(m => m.user_id === user?.id);
            const myRankIndex = reranked.findIndex(m => m.user_id === user?.id);

            // 프로필 이미지 렌더링
            const renderProfileImage = (member: typeof reranked[0]) => {
              if (member.profile_image?.startsWith('default:')) {
                const color = member.profile_image.replace('default:', '');
                return (
                  <div className="ranking-profile-placeholder" style={{ background: color, color: 'white' }}>
                    {member.display_name[0].toUpperCase()}
                  </div>
                );
              } else if (member.profile_image) {
                return <img src={member.profile_image} alt={member.display_name} className="ranking-profile" />;
              }
              return (
                <div className="ranking-profile-placeholder" style={{ background: 'var(--gradient-primary)' }}>
                  {member.display_name[0]}
                </div>
              );
            };

            // ── 내순위 탭 ────────────────────────────────────────────
            if (rankingTab === 'myrank') {
              if (!myEntry) {
                return <div className="empty-state"><p>이번 달 운동 기록이 없습니다.</p></div>;
              }
              const start = Math.max(0, myRankIndex - 3);
              const end = Math.min(reranked.length, myRankIndex + 4);
              const slice = reranked.slice(start, end);
              return (
                <div className="myrank-view">
                  <div className="myrank-view-summary">
                    <span>전체 {reranked.length}명 중 <strong>{myEntry.rank}위</strong></span>
                    {mileageCategoryFilter && (
                      <span className="myrank-view-summary-filter">{mileageCategoryFilter} 필터중</span>
                    )}
                  </div>
                  <div className="my-rank-context">
                    {start > 0 && <div className="my-rank-context-ellipsis">⋯ 위 {start}명</div>}
                    {slice.map(m => {
                      const isMe = m.user_id === user?.id;
                      return (
                        <div
                          key={m.user_id}
                          className={`my-rank-context-row${isMe ? ' my-rank-context-row--me' : ''}`}
                          onClick={() => openMemberDetail(m.user_id, m.display_name)}
                        >
                          <span className="my-rank-context-rank">{m.rank}위</span>
                          {renderProfileImage(m)}
                          <span className="my-rank-context-name">
                            {m.display_name}
                            {isMe && <span className="my-rank-badge">나</span>}
                            {m.is_hall_of_fame && <span className="hof-badge-inline">🏆</span>}
                          </span>
                          <span className="my-rank-context-mileage">{m.total_mileage.toFixed(1)}</span>
                        </div>
                      );
                    })}
                    {end < reranked.length && <div className="my-rank-context-ellipsis">⋯ 아래 {reranked.length - end}명</div>}
                  </div>
                </div>
              );
            }

            if (reranked.length === 0) {
              return (
                <>
                  {/* 필터 체크박스 */}
                  <div className="ranking-filter-checks">
                    <label className="filter-check-label">
                      <input type="checkbox" checked={hideHof} onChange={e => setHideHof(e.target.checked)} />
                      <span>명전 제외</span>
                    </label>
                    {selectedClub?.rookie_league_enabled !== false && (
                      <label className="filter-check-label">
                        <input type="checkbox" checked={rookieOnly} onChange={e => setRookieOnly(e.target.checked)} />
                        <span>루키리그</span>
                      </label>
                    )}
                    {mileageCategoryFilter && (
                      <span className="myrank-view-summary-filter" style={{ marginLeft: 'auto' }}>{mileageCategoryFilter} 필터중</span>
                    )}
                  </div>
                  <div className="empty-state"><p>운동 기록이 없습니다.</p></div>
                </>
              );
            }

            // 표시할 멤버 결정 (기존 ±3 로직, 메인 리스트용)
            let displayMembers: typeof reranked = [];
            let showEllipsis1 = false;
            let showEllipsis2 = false;
            let ellipsis1AtIdx = 5;

            const highlightIndex = highlightedUserId
              ? reranked.findIndex(m => m.user_id === highlightedUserId)
              : -1;

            if (showFullList) {
              displayMembers = reranked;
            } else if (highlightIndex !== -1) {
              const start = Math.max(0, highlightIndex - 3);
              const end = Math.min(reranked.length, highlightIndex + 6);
              displayMembers = reranked.slice(start, end);
              showEllipsis1 = start > 0;
              ellipsis1AtIdx = 0;
              showEllipsis2 = end < reranked.length;
            } else if (reranked.length <= 20) {
              displayMembers = reranked;
            } else {
              displayMembers = reranked.slice(0, 20);
              showEllipsis2 = true;
            }

            return (
              <>
                {/* 필터 체크박스 */}
                <div className="ranking-filter-checks">
                  <label className="filter-check-label">
                    <input type="checkbox" checked={hideHof} onChange={e => { setHideHof(e.target.checked); setShowFullList(false); }} />
                    <span>명전 제외</span>
                  </label>
                  {selectedClub?.rookie_league_enabled !== false && (
                    <label className="filter-check-label">
                      <input type="checkbox" checked={rookieOnly} onChange={e => { setRookieOnly(e.target.checked); setShowFullList(false); }} />
                      <span>루키리그</span>
                    </label>
                  )}
                  {mileageCategoryFilter && (
                    <span className="myrank-view-summary-filter" style={{ marginLeft: 'auto' }}>{mileageCategoryFilter} 필터중</span>
                  )}
                </div>

                <div className="ranking-list">
                  {displayMembers.map((member, idx) => {
                    const isMyRank = member.user_id === user?.id;
                    const showEllipsisBefore = showEllipsis1 && idx === ellipsis1AtIdx;

                    return (
                      <React.Fragment key={member.user_id}>
                        {showEllipsisBefore && (
                          <div className="ranking-ellipsis">
                            <div className="ellipsis-line"></div>
                            <span className="ellipsis-text">생략 ({member.rank - 1}명)</span>
                            <div className="ellipsis-line"></div>
                          </div>
                        )}
                        <div
                          className={`ranking-item clickable ${member.is_hall_of_fame ? 'hof-highlight' : ''} ${isMyRank ? 'my-rank' : ''}`}
                          style={{
                            background: member.user_id === highlightedUserId
                              ? 'var(--row-found-bg)'
                              : member.is_hall_of_fame
                              ? 'var(--row-hof-bg)'
                              : isMyRank
                              ? 'var(--row-me-bg)'
                              : undefined,
                            borderColor: member.user_id === highlightedUserId ? 'var(--row-found-border)' : member.is_hall_of_fame ? 'var(--row-hof-border)' : isMyRank ? 'var(--row-me-border)' : undefined,
                            borderWidth: member.user_id === highlightedUserId || member.is_hall_of_fame || isMyRank ? '2px' : undefined,
                          }}
                          onClick={() => openMemberDetail(member.user_id, member.display_name)}
                        >
                          <div className="ranking-left">
                            <div className={`rank-badge rank-${member.rank}`}>
                              {member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : `${member.rank}위`}
                            </div>
                            {renderProfileImage(member)}
                            <div className="ranking-info">
                              <div className="ranking-name">
                                {teamBadges[member.user_id] && (
                                  <span
                                    className="ranking-team-dot"
                                    title={teamBadges[member.user_id].name}
                                    style={{
                                      background: teamBadges[member.user_id].color,
                                      border: teamBadges[member.user_id].color.toLowerCase() === '#e2e8f0' ? '1px solid #94a3b8' : 'none',
                                    }}
                                  />
                                )}
                                {member.display_name}
                                {isMyRank && <span className="my-rank-badge">나</span>}
                                {member.is_hall_of_fame && <span className="hof-badge-inline">🏆</span>}
                                {selectedClub?.rookie_league_enabled !== false && member.is_rookie && (
                                  <span className="rookie-badge">루키</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="ranking-right">
                            <div className="ranking-mileage">{member.total_mileage.toFixed(1)}</div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {showEllipsis2 && (
                    <div className="ranking-ellipsis">
                      <div className="ellipsis-line"></div>
                      <span className="ellipsis-text">이하 생략 (총 {reranked.length}명)</span>
                      <div className="ellipsis-line"></div>
                    </div>
                  )}
                  <button
                    className="show-full-list-button"
                    onClick={() => { setShowFullList(v => !v); setHighlightedUserId(null); }}
                    style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showFullList ? '▲ 접기' : `▼ 전체 리스트 보기 (${reranked.length}명)`}
                  </button>
                </div>
              </>
            );
          })()}

          {/* 명예의 전당 카드 */}
          {!rankingLoading && (() => {
            const hofAll = ranking.filter(m => m.is_hall_of_fame);
            if (hofAll.length === 0) return null;
            const hofMembers = ranking.filter(m => m.is_hall_of_fame && m.workout_count > 0 && m.total_mileage > 0);

            const renderHofProfile = (member: typeof hofAll[0]) => {
              if (member.profile_image?.startsWith('default:')) {
                const color = member.profile_image.replace('default:', '');
                return <div className="hof-card-avatar" style={{ background: color }}>{member.display_name[0].toUpperCase()}</div>;
              } else if (member.profile_image) {
                return <img src={member.profile_image} alt={member.display_name} className="hof-card-avatar hof-card-avatar--img" />;
              }
              return <div className="hof-card-avatar" style={{ background: 'var(--gradient-primary)' }}>{member.display_name[0]}</div>;
            };

            return (
              <div className="hof-section-card">
                <button className="hof-section-toggle" onClick={() => setShowHof(v => !v)}>
                  <span>🏆 명예의 전당</span>
                  <span className="hof-section-count">{hofAll.length}명</span>
                  <span className="hof-section-arrow">{showHof ? '▲' : '▼'}</span>
                </button>
                {showHof && (
                  <>
                    <div className="hof-gallery">
                      {hofAll.map(member => (
                        <div
                          key={member.user_id}
                          className="hof-card"
                          onClick={() => openMemberDetail(member.user_id, member.display_name)}
                        >
                          <div className="hof-card-crown">🏆</div>
                          {renderHofProfile(member)}
                          <div className="hof-card-name">{member.display_name}</div>
                          <div className="hof-card-reason">{member.hof_reason || '명예의 전당 멤버'}</div>
                          {hofMembers.find(m => m.user_id === member.user_id) && (
                            <div className="hof-card-mileage">
                              이번 달 {hofMembers.find(m => m.user_id === member.user_id)!.total_mileage.toFixed(1)}점
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="hof-tab-description">
                      <p>월별 1위 등 특별한 업적을 달성한 멤버를 운영자 논의 후 등재합니다.</p>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

        </div>
      ) : (
        <div className="empty-state">
          <p>가입한 클럽이 없습니다.</p>
          <p>클럽을 만들거나 초대 코드로 가입해보세요!</p>
        </div>
      ))}

      {/* 소셜 탭 — 미출시, 비활성화 */}

      {/* 오늘의 운동 피드 */}
      {activeTab === 'feed' && selectedClub && (
        <WorkoutFeed
          clubId={selectedClub.id}
          clubName={selectedClub.name}
          selectedDate={selectedDate}
          feedItems={feedItems.map(item => {
            const categoryKey = item.workout.sub_type
              ? `${item.workout.category}-${item.workout.sub_type}`
              : item.workout.category;
            return {
              ...item,
              is_disabled: enabledCategorySet.size > 0 && !enabledCategorySet.has(categoryKey),
            };
          })}
          loading={feedLoading}
          onDateChange={handleDateChange}
          onDateSelect={handleDateSelect}
          onOptimisticLike={handleOptimisticLike}
          onOptimisticCommentAdd={handleOptimisticCommentAdd}
          onOptimisticCommentDelete={handleOptimisticCommentDelete}
          onBlock={handleBlock}
          onMemberClick={(userId, userName) => openMemberDetail(userId, userName)}
        />
      )}

      {/* 멤버 상세 모달 */}
      {selectedMember && selectedClub && (
        <ClubMemberDetailModal
          clubId={selectedClub.id}
          userId={selectedMember.userId}
          userName={selectedMember.userName}
          initialYear={selectedMember.year}
          initialMonth={selectedMember.month}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {/* 모달 */}
      {showCreateModal && (
        <CreateClubModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadMyClubs}
        />
      )}

      {showMemberSearch && (() => {
        const searchResults = memberSearchQuery
          ? ranking.filter(m => m.display_name.toLowerCase().includes(memberSearchQuery.toLowerCase()))
          : [];

        const renderAvatar = (m: ClubRanking) => {
          if (m.profile_image?.startsWith('default:')) {
            const color = m.profile_image.replace('default:', '');
            return (
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 600, flexShrink: 0,
              }}>
                {m.display_name[0].toUpperCase()}
              </div>
            );
          } else if (m.profile_image) {
            return (
              <img src={m.profile_image} alt={m.display_name} style={{
                width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
              }} />
            );
          } else {
            return (
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--gradient-primary)',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 600, flexShrink: 0,
              }}>
                {m.display_name[0]}
              </div>
            );
          }
        };

        return (
          <div className="modal-overlay modal-overlay--top" onClick={() => setShowMemberSearch(false)}>
            <div className="modal-content" style={{ maxWidth: '480px', width: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ flexShrink: 0 }}>
                <h2>멤버 검색</h2>
                <button className="modal-close" onClick={() => setShowMemberSearch(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '16px' }}>
                <input
                  type="text"
                  placeholder="닉네임으로 검색..."
                  value={memberSearchQuery}
                  onChange={e => setMemberSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    fontSize: '15px',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                    outline: 'none',
                  }}
                />
                <div style={{ marginTop: '12px', flex: 1, overflowY: 'auto' }}>
                  {searchResults.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', padding: '32px 0' }}>
                      검색 결과 없음
                    </div>
                  ) : (
                    searchResults.map(m => (
                      <div
                        key={m.user_id}
                        onClick={() => {
                          setHighlightedUserId(m.user_id);
                          setShowFullList(false);
                          setShowMemberSearch(false);
                          setMemberSearchQuery('');
                          setRankingTab('all');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 8px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = 'var(--input-bg)')}
                        onMouseOut={e => (e.currentTarget.style.background = '')}
                      >
                        {renderAvatar(m)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {m.display_name}
                            {m.is_hall_of_fame && <span style={{ fontSize: '13px' }}>🏆</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {m.rank}위 · {m.total_mileage.toFixed(1)} 마일리지
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          운동 {m.workout_count}회
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showMileageConfig && selectedClub && (
        <MileageConfigModal
          clubId={selectedClub.id}
          onClose={() => setShowMileageConfig(false)}
        />
      )}

      {showDetailedStats && selectedClub && (
        <ClubDetailedStatsModal
          clubId={selectedClub.id}
          clubName={selectedClub.name}
          month={{
            year: selectedMonth.getFullYear(),
            month: selectedMonth.getMonth() + 1,
          }}
          onClose={() => setShowDetailedStats(false)}
        />
      )}

      {/* 챌린지 만들기 모달 */}
      {showMonthPicker && (
        <div className="modal-overlay modal-overlay--top" onClick={() => setShowMonthPicker(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px', width: '92vw' }}
          >
            <div className="modal-header">
              <h2>월/연도 선택</h2>
              <button className="modal-close" onClick={() => setShowMonthPicker(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="dashboard-action-button"
                  onClick={() => setMonthPickerYear((y) => y - 1)}
                  aria-label="연도 감소"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="number"
                  value={monthPickerYear}
                  onChange={(e) => setMonthPickerYear(Number(e.target.value) || selectedMonth.getFullYear())}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '16px',
                    textAlign: 'center',
                  }}
                />
                <button
                  type="button"
                  className="dashboard-action-button"
                  onClick={() => setMonthPickerYear((y) => y + 1)}
                  aria-label="연도 증가"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                }}
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => {
                      setMonthPickerMonth(month);
                      applyMonthSelection(monthPickerYear, month);
                    }}
                    style={{
                      padding: '12px 0',
                      borderRadius: '10px',
                      border: monthPickerMonth === month ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      background: monthPickerMonth === month ? 'rgba(59, 130, 246, 0.12)' : 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {month}월
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="dashboard-action-button"
                  onClick={() => setShowMonthPicker(false)}
                >
                  닫기
                </button>
                <button
                  type="button"
                  className="dashboard-action-button"
                  onClick={() => applyMonthSelection(monthPickerYear, monthPickerMonth)}
                  style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChallengeCreate && selectedClub && user && (
        <ChallengeCreateModal
          club={selectedClub}
          userId={user.id}
          onClose={() => setShowChallengeCreate(false)}
          onCreated={() => {
            setShowChallengeCreate(false);
            setChallengeRefreshKey((k) => k + 1);
          }}
          onTeamMatchCreated={(info) => {
            setShowChallengeCreate(false);
            setAssignInfo(info);
          }}
        />
      )}

      {/* 팀 배정 모달 (팀 대항전 생성 직후 or 재배정) */}
      {assignInfo && selectedClub && (
        <TeamAssignModal
          challengeId={assignInfo.id}
          club={selectedClub}
          startDate={assignInfo.startDate}
          baselineMonths={assignInfo.baselineMonths}
          onClose={() => {
            setAssignInfo(null);
            setChallengeRefreshKey((k) => k + 1);
          }}
          onSaved={() => {
            setAssignInfo(null);
            setChallengeRefreshKey((k) => k + 1);
          }}
        />
      )}

      {/* 지난 챌린지 아카이브 모달 */}
      {showChallengeArchive && selectedClub && (
        <ChallengeArchiveModal
          clubId={selectedClub.id}
          clubName={selectedClub.name}
          isManager={selectedClub.role === 'manager' || selectedClub.role === 'vice-manager'}
          onClose={() => setShowChallengeArchive(false)}
        />
      )}

      {/* 클럽 초대 모달 */}
      {showInviteModal && selectedClub && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>클럽 초대하기</h2>
              <button className="modal-close" onClick={() => setShowInviteModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="invite-info">
                <div className="invite-club-name">{selectedClub.name}</div>
                <div className="invite-code">초대 코드: {selectedClub.invite_code}</div>
              </div>
              <div className="invite-actions">
                <button
                  className="invite-action-button kakao"
                  onClick={handleKakaoInviteShare}
                >
                  <span className="action-icon">💬</span>
                  <div className="action-text">
                    <div className="action-title">카카오톡으로 공유</div>
                    <div className="action-desc">친구에게 초대 메시지 보내기</div>
                  </div>
                </button>
                <button
                  className="invite-action-button"
                  onClick={handleCopyInviteLink}
                >
                  <span className="action-icon">📋</span>
                  <div className="action-text">
                    <div className="action-title">초대 링크 복사</div>
                    <div className="action-desc">메시지나 이메일로 공유하기</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 클럽 메뉴 바텀시트 */}
      {showClubMenu && selectedClub && (
        <div className="cmenu-overlay" onClick={() => setShowClubMenu(false)}>
          <div className="cmenu-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cmenu-handle" />
            <div className="cmenu-head">
              <span className="cmenu-head-title">클럽 메뉴</span>
              <button type="button" className="cmenu-head-close" onClick={() => setShowClubMenu(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="cmenu-body">
              {/* 기본 */}
              <div className="cmenu-group">
                <button type="button" className="cmenu-row" onClick={() => { setShowClubMenu(false); navigate(`/club/my-settings/${selectedClub.id}`); }}>
                  <User size={18} className="cmenu-row-icon" />
                  <div className="cmenu-row-text">
                    <div className="cmenu-row-title">내 정보 변경</div>
                    <div className="cmenu-row-desc">별명, 정보공유 설정 등</div>
                  </div>
                  <ChevronRight size={16} className="cmenu-arrow" />
                </button>
                <button type="button" className="cmenu-row" onClick={() => { setShowClubMenu(false); navigate(`/club/members/${selectedClub.id}`); }}>
                  <Users size={18} className="cmenu-row-icon" />
                  <div className="cmenu-row-text">
                    <div className="cmenu-row-title">클럽원 리스트</div>
                    <div className="cmenu-row-desc">클럽원 목록 및 관리</div>
                  </div>
                  <ChevronRight size={16} className="cmenu-arrow" />
                </button>
                <button type="button" className="cmenu-row" onClick={() => { setShowClubMenu(false); navigate(`/club/gallery/${selectedClub.id}`); }}>
                  <Image size={18} className="cmenu-row-icon" />
                  <div className="cmenu-row-text">
                    <div className="cmenu-row-title">사진 갤러리</div>
                    <div className="cmenu-row-desc">증빙사진 모아보기</div>
                  </div>
                  <ChevronRight size={16} className="cmenu-arrow" />
                </button>
              </div>

              {/* 챌린지 */}
              <div className="cmenu-group">
                <button type="button" className="cmenu-row" onClick={() => setChallengeMenuOpen(v => !v)}>
                  <Trophy size={18} className="cmenu-row-icon" />
                  <div className="cmenu-row-text">
                    <div className="cmenu-row-title">챌린지</div>
                  </div>
                  <ChevronDown size={16} className={`cmenu-caret${challengeMenuOpen ? ' cmenu-caret--open' : ''}`} />
                </button>
                {challengeMenuOpen && (
                  <>
                    <button type="button" className="cmenu-row cmenu-row--sub" onClick={() => { setShowClubMenu(false); setShowChallengeArchive(true); }}>
                      <Clock size={16} className="cmenu-row-icon" />
                      <div className="cmenu-row-text">
                        <div className="cmenu-row-title">지난 챌린지</div>
                        <div className="cmenu-row-desc">종료된 챌린지 결과 보기</div>
                      </div>
                      <ChevronRight size={16} className="cmenu-arrow" />
                    </button>
                    {(selectedClub.role === 'manager' || selectedClub.role === 'vice-manager') && (
                      <button type="button" className="cmenu-row cmenu-row--sub" onClick={() => { setShowClubMenu(false); setShowChallengeCreate(true); }}>
                        <Plus size={16} className="cmenu-row-icon" />
                        <div className="cmenu-row-text">
                          <div className="cmenu-row-title">챌린지 만들기</div>
                          <div className="cmenu-row-desc">새 챌린지 개설</div>
                        </div>
                        <ChevronRight size={16} className="cmenu-arrow" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 클럽 관리 (관리자) → 설정 허브 페이지 */}
              {(selectedClub.role === 'manager' || selectedClub.role === 'vice-manager') && (
                <div className="cmenu-group">
                  <button type="button" className="cmenu-row" onClick={() => { setShowClubMenu(false); navigate(`/club/settings/${selectedClub.id}`); }}>
                    <Settings size={18} className="cmenu-row-icon" />
                    <div className="cmenu-row-text">
                      <div className="cmenu-row-title">클럽 관리</div>
                      <div className="cmenu-row-desc">마일리지, 통계, 클럽원 관리 등</div>
                    </div>
                    <span className="cmenu-badge">{user && selectedClub.created_by === user.id ? '클럽장' : '관리자'}</span>
                    <ChevronRight size={16} className="cmenu-arrow" />
                  </button>
                </div>
              )}

              {/* 클럽 탈퇴 (관리자는 비활성) */}
              {user && (
                <div className="cmenu-group cmenu-group--danger">
                  <button
                    type="button"
                    className="cmenu-row cmenu-row--danger"
                    disabled={selectedClub.role === 'manager' || selectedClub.role === 'vice-manager'}
                    onClick={async () => {
                      if (!confirm(`${selectedClub.name}에서 탈퇴하시겠습니까?\n\n탈퇴 후에도 초대코드로 다시 가입할 수 있습니다.`)) return;
                      try {
                        await clubService.leaveClub(selectedClub.id, user.id);
                        alert('클럽에서 탈퇴했습니다.');
                        setShowClubMenu(false);
                        loadMyClubs();
                      } catch (error) {
                        console.error('클럽 탈퇴 실패:', error);
                        alert('클럽 탈퇴에 실패했습니다.');
                      }
                    }}
                  >
                    <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>🚪</span>
                    <div className="cmenu-row-text">
                      <div className="cmenu-row-title">클럽 탈퇴</div>
                      <div className="cmenu-row-desc">이 클럽에서 나가기</div>
                    </div>
                  </button>
                  {(selectedClub.role === 'manager' || selectedClub.role === 'vice-manager') && (
                    <div className="cmenu-group-note">
                      관리자 자격이 없어야 탈퇴할 수 있습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
