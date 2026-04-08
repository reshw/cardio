import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import { CreateClubModal } from '../components/CreateClubModal';
import { MileageConfigModal } from '../components/MileageConfigModal';
import { ClubDetailedStatsModal } from '../components/ClubDetailedStatsModal';
import { WorkoutFeed } from '../components/WorkoutFeed';
import type { MyClubWithOrder, ClubRanking } from '../services/clubService';
import type { WorkoutFeedItem } from '../services/feedService';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info, Table, Users, TrendingUp, User, RefreshCw, UserRoundPlus, Settings, Search } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 드래그 가능한 클럽 아이템
function SortableClubItem({ club, isSelected, onSelect }: {
  club: MyClubWithOrder;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: club.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-club-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        ⋮⋮
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
  const [myClubs, setMyClubs] = useState<MyClubWithOrder[]>([]);
  const [selectedClub, setSelectedClub] = useState<MyClubWithOrder | null>(null);
  const [ranking, setRanking] = useState<ClubRanking[]>([]);
  const [loading, setLoading] = useState(true); // 초기 로딩 true로 설정
  const [rankingLoading, setRankingLoading] = useState(false); // 랭킹 로딩 별도 관리
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMileageConfig, setShowMileageConfig] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showClubMenu, setShowClubMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // 피드 관련 state
  type TabType = 'ranking' | 'feed';
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [feedItems, setFeedItems] = useState<WorkoutFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  // 피드 캐시: { clubId-dateString: WorkoutFeedItem[] }
  const [feedCache, setFeedCache] = useState<Record<string, WorkoutFeedItem[]>>({});

  // 명예의 전당 필터 state
  type RankingFilter = 'all' | 'hof' | 'regular';
  const [rankingFilter, setRankingFilter] = useState<RankingFilter>('all');
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [showFullList, setShowFullList] = useState(false);

  // 랭킹 월 선택 state
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    setRankingLoading(true);
    try {
      const targetMonth = month || selectedMonth;
      const data = await clubService.getClubRanking(clubId, {
        year: targetMonth.getFullYear(),
        month: targetMonth.getMonth() + 1,
      });
      setRanking(data);
    } catch (error) {
      console.error('랭킹 불러오기 실패:', error);
    } finally {
      setRankingLoading(false);
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

      // 비활성화된 카테고리 체크하여 is_disabled 필드 추가
      const enabledCategories = selectedClub?.enabled_categories || [];
      const itemsWithDisabledFlag = items.map(item => {
        const categoryKey = item.workout.sub_type
          ? `${item.workout.category}-${item.workout.sub_type}`
          : item.workout.category;
        const isDisabled = !enabledCategories.includes(categoryKey);

        return {
          ...item,
          is_disabled: isDisabled,
        };
      });

      setFeedItems(itemsWithDisabledFlag);

      // 캐시 저장
      setFeedCache(prev => ({
        ...prev,
        [cacheKey]: itemsWithDisabledFlag,
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

  // 마일리지 재계산
  const handleRecalculateMileage = async () => {
    if (!selectedClub) return;

    if (!confirm('현재 월의 모든 운동 기록 마일리지를 재계산하시겠습니까?\n\n현재 클럽의 마일리지 계수로 전체 재계산됩니다.')) {
      return;
    }

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      await clubService.recalculateClubMonthMileage(selectedClub.id, year, month);
      alert('마일리지 재계산이 완료되었습니다.');

      // 랭킹 새로고침
      loadClubRanking(selectedClub.id);
    } catch (error) {
      console.error('마일리지 재계산 실패:', error);
      alert('마일리지 재계산에 실패했습니다.');
    }
  };

  useEffect(() => {
    loadMyClubs();
  }, [user]);

  // 페이지가 다시 보일 때 랭킹 새로고침 (뒤로가기 대응)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedClub) {
        console.log('📊 페이지 재표시 - 랭킹 새로고침');
        loadClubRanking(selectedClub.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedClub]);

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

  // 드래그 앤 드롭으로 순서 변경
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = myClubs.findIndex((c) => c.id === active.id);
    const newIndex = myClubs.findIndex((c) => c.id === over.id);

    const newOrder = arrayMove(myClubs, oldIndex, newIndex);
    setMyClubs(newOrder);

    // 서버에 순서 저장
    try {
      const clubOrders = newOrder.map((club, index) => ({
        club_id: club.id,
        order: index,
      }));
      await clubService.updateClubOrder(user!.id, clubOrders);
    } catch (error) {
      console.error('순서 변경 실패:', error);
      // 실패 시 되돌리기
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

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={myClubs.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="sortable-club-list">
                    {myClubs.map((club) => (
                      <SortableClubItem
                        key={club.id}
                        club={club}
                        isSelected={selectedClub?.id === club.id}
                        onSelect={() => handleSelectClub(club)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="dropdown-footer">
                드래그하여 순서 변경
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

      {/* 탭 */}
      {selectedClub && (
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'ranking' ? 'active' : ''}`}
            onClick={() => setActiveTab('ranking')}
          >
            🏆 마일리지
          </button>
          <button
            className={`tab ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            🏃 오늘의 운동
          </button>
        </div>
      )}

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
              <h2>{selectedMonth.getFullYear()}년 {String(selectedMonth.getMonth() + 1).padStart(2, '0')}월</h2>
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
              >
                <Search size={16} />
              </button>
              <button
                className="dashboard-action-button"
                onClick={() => setShowDetailedStats(true)}
                title="상세 통계"
              >
                <Table size={16} />
              </button>
            </div>
          </div>

          {/* 명예의 전당 필터 */}
          <div className="ranking-filter-tabs">
            <button
              className={`filter-tab ${rankingFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRankingFilter('all')}
            >
              전체
            </button>
            <button
              className={`filter-tab ${rankingFilter === 'regular' ? 'active' : ''}`}
              onClick={() => setRankingFilter('regular')}
            >
              일반 회원
            </button>
            <button
              className={`filter-tab ${rankingFilter === 'hof' ? 'active' : ''}`}
              onClick={() => setRankingFilter('hof')}
            >
              🏆 명예의 전당
            </button>
          </div>

          {rankingLoading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>랭킹 불러오는 중...</p>
            </div>
          ) : (() => {
            const filtered = ranking.filter(m => m.workout_count > 0 && m.total_mileage > 0);
            const filteredByHOF = rankingFilter === 'hof'
              ? filtered.filter(m => m.is_hall_of_fame)
              : rankingFilter === 'regular'
              ? filtered.filter(m => !m.is_hall_of_fame)
              : filtered;

            if (filteredByHOF.length === 0) {
              return (
                <div className="empty-state">
                  <p>{rankingFilter === 'hof' ? '명예의 전당 멤버가 없습니다.' : rankingFilter === 'regular' ? '일반 회원의 운동 기록이 없습니다.' : '이번 달 운동 기록이 없습니다.'}</p>
                </div>
              );
            }

            // 본인 순위 찾기
            const myRankIndex = filteredByHOF.findIndex(m => m.user_id === user?.id);
            const myRank = myRankIndex !== -1 ? myRankIndex : -1;

            // 표시할 멤버 결정
            let displayMembers: typeof filteredByHOF = [];
            let showEllipsis1 = false;
            let showEllipsis2 = false;
            let ellipsis1AtIdx = 5; // showEllipsis1이 표시될 displayMembers 인덱스

            // 검색으로 강조된 멤버 기준 표시
            const highlightIndex = highlightedUserId
              ? filteredByHOF.findIndex(m => m.user_id === highlightedUserId)
              : -1;

            if (showFullList) {
              displayMembers = filteredByHOF;
            } else if (highlightIndex !== -1) {
              // 강조 멤버 ±5명 표시
              const start = Math.max(0, highlightIndex - 5);
              const end = Math.min(filteredByHOF.length, highlightIndex + 6);
              displayMembers = filteredByHOF.slice(start, end);
              showEllipsis1 = start > 0;
              ellipsis1AtIdx = 0; // 검색 결과는 첫 번째 항목 앞에 중략 표시
              showEllipsis2 = end < filteredByHOF.length;
            } else if (myRank < 20 && myRank !== -1) {
              // 본인이 20위 안에 있으면 1~20위까지만 표시
              displayMembers = filteredByHOF.slice(0, 20);
              if (filteredByHOF.length > 20) {
                showEllipsis2 = true;
              }
            } else if (myRank === -1 && filteredByHOF.length <= 20) {
              // 본인 순위 없고 총 20명 이하면 전체 표시
              displayMembers = filteredByHOF;
            } else {
              // 본인이 21위 이상 또는 순위 없고 21명 이상
              // 상위 5명
              displayMembers = filteredByHOF.slice(0, 5);

              // 본인이 있으면 본인 구간 추가
              if (myRank >= 5) {
                showEllipsis1 = true;

                // 본인 위3개, 아래3개 추가 (총 7명: 위3 + 본인 + 아래3)
                const start = Math.max(5, myRank - 3);
                const end = Math.min(filteredByHOF.length, myRank + 4);
                const mySection = filteredByHOF.slice(start, end);

                displayMembers = [...displayMembers, ...mySection];

                // 본인 아래에 더 있으면 생략 표시
                if (myRank + 4 < filteredByHOF.length) {
                  showEllipsis2 = true;
                }
              } else {
                // 본인이 5위 안이지만 5위 뒤에 더 있으면 생략 표시
                showEllipsis2 = true;
              }
            }

            return (
              <div className="ranking-list">
                {displayMembers.map((member, idx) => {
                const isMyRank = member.user_id === user?.id;

                // 생략 표시 (5위와 본인 구간 사이)
                const showEllipsisBefore = showEllipsis1 && idx === ellipsis1AtIdx;

                // 프로필 이미지 렌더링 (default:color 형식 처리)
                const renderProfileImage = () => {
                  if (member.profile_image?.startsWith('default:')) {
                    const color = member.profile_image.replace('default:', '');
                    return (
                      <div
                        className="ranking-profile-placeholder"
                        style={{ background: color, color: 'white' }}
                      >
                        {member.display_name[0].toUpperCase()}
                      </div>
                    );
                  } else if (member.profile_image) {
                    return (
                      <img
                        src={member.profile_image}
                        alt={member.display_name}
                        className="ranking-profile"
                      />
                    );
                  } else {
                    return (
                      <div
                        className="ranking-profile-placeholder"
                        style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}
                      >
                        {member.display_name[0]}
                      </div>
                    );
                  }
                };

                return (
                  <React.Fragment key={member.user_id}>
                    {showEllipsisBefore && (
                      <div className="ranking-ellipsis">
                        <div className="ellipsis-line"></div>
                        <span className="ellipsis-text">생략 ({highlightIndex !== -1 ? member.rank - 1 : member.rank - 6}명)</span>
                        <div className="ellipsis-line"></div>
                      </div>
                    )}
                    <div
                      className={`ranking-item clickable ${member.is_hall_of_fame ? 'hof-highlight' : ''} ${isMyRank ? 'my-rank' : ''}`}
                      style={{
                        background: member.user_id === highlightedUserId
                          ? 'linear-gradient(135deg, #FFE4EE 0%, #FFB6C1 100%)'
                          : member.is_hall_of_fame
                          ? 'linear-gradient(135deg, #FFF9E6 0%, #FFFAED 100%)'
                          : isMyRank
                          ? 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)'
                          : undefined,
                        borderColor: member.user_id === highlightedUserId ? '#FF6B9D' : member.is_hall_of_fame ? '#FFD700' : isMyRank ? '#2196F3' : undefined,
                        borderWidth: member.user_id === highlightedUserId || member.is_hall_of_fame || isMyRank ? '2px' : undefined,
                      }}
                      onClick={() =>
                        navigate(
                          `/club/member/${selectedClub?.id}/${member.user_id}/${encodeURIComponent(member.display_name)}`
                        )
                      }
                    >
                    {rankingFilter === 'hof' ? (
                      // 명예의전당 탭: 순위/운동횟수/마일리지 제거, reason 표시
                      <>
                        <div className="ranking-left">
                          {renderProfileImage()}
                          <div className="ranking-info">
                            <div className="ranking-name">
                              {member.display_name}
                              <span className="hof-badge-inline">🏆</span>
                            </div>
                          </div>
                        </div>
                        <div className="ranking-right">
                          <div className="hof-reason">
                            {member.hof_reason || '명예의 전당 멤버'}
                          </div>
                        </div>
                      </>
                    ) : (
                      // 일반/전체 탭: 기존 렌더링
                      <>
                        <div className="ranking-left">
                          {(() => {
                            // 일반 회원 탭은 별도 순위 번호 사용
                            const displayRank = rankingFilter === 'regular'
                              ? filteredByHOF.findIndex(m => m.user_id === member.user_id) + 1
                              : member.rank;

                            return (
                              <div className={`rank-badge rank-${displayRank}`}>
                                {displayRank === 1 ? '🥇' : displayRank === 2 ? '🥈' : displayRank === 3 ? '🥉' : `${displayRank}위`}
                              </div>
                            );
                          })()}
                          {renderProfileImage()}
                          <div className="ranking-info">
                            <div className="ranking-name">
                              {member.display_name}
                              {isMyRank && <span className="my-rank-badge">나</span>}
                              {member.is_hall_of_fame && <span className="hof-badge-inline">🏆</span>}
                            </div>
                          </div>
                        </div>
                        <div className="ranking-right">
                          <div className="ranking-mileage">
                            {member.total_mileage.toFixed(1)}
                          </div>
                          {rankingFilter === 'regular' && <div className="ranking-regular-label">(일반)</div>}
                        </div>
                      </>
                    )}
                  </div>
                  </React.Fragment>
                );
              })}
              {showEllipsis2 && (
                <div className="ranking-ellipsis">
                  <div className="ellipsis-line"></div>
                  <span className="ellipsis-text">이하 생략 (총 {filteredByHOF.length}명)</span>
                  <div className="ellipsis-line"></div>
                </div>
              )}
              <button
                className="show-full-list-button"
                onClick={() => {
                  setShowFullList(v => !v);
                  setHighlightedUserId(null);
                }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '10px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {showFullList ? '▲ 접기' : `▼ 전체 리스트 보기 (${filteredByHOF.length}명)`}
              </button>
              </div>
            );
          })()}

          {/* 명예의전당 탭 설명 */}
          {rankingFilter === 'hof' && (
            <div className="hof-tab-description">
              <p>명예의 전당은 월별 1위 등 특별한 업적을 달성한 멤버를 운영자 논의 후 등재합니다.</p>
            </div>
          )}

        </div>
      ) : (
        <div className="empty-state">
          <p>가입한 클럽이 없습니다.</p>
          <p>클럽을 만들거나 초대 코드로 가입해보세요!</p>
        </div>
      ))}

      {/* 오늘의 운동 피드 */}
      {activeTab === 'feed' && selectedClub && (
        <WorkoutFeed
          clubId={selectedClub.id}
          clubName={selectedClub.name}
          selectedDate={selectedDate}
          feedItems={feedItems}
          loading={feedLoading}
          onDateChange={handleDateChange}
          onOptimisticLike={handleOptimisticLike}
          onOptimisticCommentAdd={handleOptimisticCommentAdd}
          onOptimisticCommentDelete={handleOptimisticCommentDelete}
          onBlock={handleBlock}
        />
      )}

      {/* 모달 */}
      {showCreateModal && (
        <CreateClubModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadMyClubs}
        />
      )}

      {showMemberSearch && (
        <div className="modal-overlay" onClick={() => setShowMemberSearch(false)}>
          <div className="modal-content" style={{ maxWidth: '360px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>멤버 검색</h2>
              <button className="modal-close" onClick={() => setShowMemberSearch(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="닉네임으로 검색..."
                  value={memberSearchQuery}
                  onChange={e => setMemberSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
                {memberSearchQuery && (() => {
                  const results = ranking.filter(m =>
                    m.display_name.toLowerCase().includes(memberSearchQuery.toLowerCase())
                  );
                  return results.length > 0 ? (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      marginTop: '4px',
                      zIndex: 10,
                      maxHeight: '240px',
                      overflowY: 'auto',
                    }}>
                      {results.map(m => (
                        <div
                          key={m.user_id}
                          onClick={() => {
                            setHighlightedUserId(m.user_id);
                            setShowFullList(false);
                            setShowMemberSearch(false);
                            setMemberSearchQuery('');
                          }}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            fontSize: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = 'var(--input-bg)')}
                          onMouseOut={e => (e.currentTarget.style.background = '')}
                        >
                          <span>{m.display_name}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{m.rank}위 · {m.total_mileage.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      marginTop: '4px',
                      padding: '12px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                    }}>
                      검색 결과 없음
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMileageConfig && selectedClub && (
        <MileageConfigModal
          config={selectedClub.mileage_config || clubService.getDefaultMileageConfig()}
          enabledCategories={selectedClub.enabled_categories}
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

      {/* 클럽 메뉴 모달 */}
      {showClubMenu && selectedClub && (
        <div className="modal-overlay" onClick={() => setShowClubMenu(false)}>
          <div className="modal-content more-menu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>클럽 메뉴</h2>
              <button className="modal-close" onClick={() => setShowClubMenu(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="more-menu-list">
                <button
                  className="more-menu-item"
                  onClick={() => {
                    setShowClubMenu(false);
                    navigate(`/club/my-settings/${selectedClub.id}`);
                  }}
                >
                  <User size={20} />
                  <div className="more-menu-text">
                    <div className="more-menu-title">내 정보 변경</div>
                    <div className="more-menu-desc">별명, 정보공유 설정 등</div>
                  </div>
                </button>

                <button
                  className="more-menu-item"
                  onClick={() => {
                    setShowClubMenu(false);
                    navigate(`/club/members/${selectedClub.id}`);
                  }}
                >
                  <Users size={20} />
                  <div className="more-menu-text">
                    <div className="more-menu-title">클럽원 리스트</div>
                    <div className="more-menu-desc">클럽원 목록 및 관리</div>
                  </div>
                </button>

                {/* 마일리지 재계산 - 매니저/부매니저만 */}
                {(selectedClub.role === 'manager' || selectedClub.role === 'vice-manager') && (
                  <button
                    className="more-menu-item"
                    onClick={() => {
                      setShowClubMenu(false);
                      handleRecalculateMileage();
                    }}
                  >
                    <RefreshCw size={20} />
                    <div className="more-menu-text">
                      <div className="more-menu-title">마일리지 재계산</div>
                      <div className="more-menu-desc">현재 월 전체 마일리지 새로고침</div>
                    </div>
                  </button>
                )}

                {/* 마일리지 계수 설정 - 매니저/부매니저만 */}
                {(selectedClub.role === 'manager' || selectedClub.role === 'vice-manager') && (
                  <button
                    className="more-menu-item"
                    onClick={() => {
                      setShowClubMenu(false);
                      navigate(`/club/settings/${selectedClub.id}/mileage`);
                    }}
                  >
                    <TrendingUp size={20} />
                    <div className="more-menu-text">
                      <div className="more-menu-title">마일리지 계수 설정</div>
                      <div className="more-menu-desc">운동별 계수 조정</div>
                    </div>
                  </button>
                )}

                {user && selectedClub.created_by === user.id && (
                  <>
                    <button
                      className="more-menu-item"
                      onClick={() => {
                        setShowClubMenu(false);
                        navigate(`/club/settings/${selectedClub.id}/general`);
                      }}
                    >
                      <Info size={20} />
                      <div className="more-menu-text">
                        <div className="more-menu-title">클럽 정보 변경</div>
                        <div className="more-menu-desc">이름, 설명, 로고 수정</div>
                      </div>
                    </button>

                    <button
                      className="more-menu-item"
                      onClick={() => {
                        setShowClubMenu(false);
                        navigate(`/club/settings/${selectedClub.id}/transfer`);
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>👑</span>
                      <div className="more-menu-text">
                        <div className="more-menu-title">클럽장 권한 넘기기</div>
                        <div className="more-menu-desc">다른 멤버에게 클럽장 위임</div>
                      </div>
                    </button>
                  </>
                )}

                {/* 클럽 탈퇴 */}
                {user && selectedClub.created_by !== user.id && (
                  <button
                    className="more-menu-item danger"
                    onClick={async () => {
                      if (!confirm(`${selectedClub.name}에서 탈퇴하시겠습니까?\n\n탈퇴 후에도 초대코드로 다시 가입할 수 있습니다.`)) {
                        return;
                      }

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
                    <span style={{ fontSize: '20px' }}>🚪</span>
                    <div className="more-menu-text">
                      <div className="more-menu-title">클럽 탈퇴</div>
                      <div className="more-menu-desc">이 클럽에서 나가기</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
