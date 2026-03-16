import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import { CreateClubModal } from '../components/CreateClubModal';
import { MileageConfigModal } from '../components/MileageConfigModal';
import { ClubDetailedStatsModal } from '../components/ClubDetailedStatsModal';
import type { MyClubWithOrder, ClubRanking } from '../services/clubService';
import { Settings, Copy, ChevronDown, ChevronUp, Info, Table } from 'lucide-react';
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
        <div className="club-item-name">{club.name}</div>
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
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMileageConfig, setShowMileageConfig] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);

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

      // 가장 상위 클럽을 자동 선택
      if (data.length > 0 && !selectedClub) {
        const firstClub = data[0];
        setSelectedClub(firstClub);
        loadClubRanking(firstClub.id);
      }
    } catch (error) {
      console.error('내 클럽 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 클럽 랭킹 불러오기
  const loadClubRanking = async (clubId: string) => {
    setLoading(true);
    try {
      const now = new Date();
      const data = await clubService.getClubRanking(clubId, {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
      setRanking(data);
    } catch (error) {
      console.error('랭킹 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyClubs();
  }, [user]);

  // 클럽 선택
  const handleSelectClub = async (club: MyClubWithOrder) => {
    setSelectedClub(club);
    setShowDropdown(false);
    loadClubRanking(club.id);
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

  // 초대 코드 복사 (전체 URL)
  const copyInviteCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const inviteUrl = `${window.location.origin}/join/${code}`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        alert('클럽 초대링크가 복사되었습니다! 📋\n카톡이나 메시지에 붙여넣어서 공유해보세요.');
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('클럽 초대링크가 복사되었습니다! 📋\n카톡이나 메시지에 붙여넣어서 공유해보세요.');
    }
  };

  return (
    <div className="container">
      {/* 헤더 */}
      <div className="header">
        <h1>클럽</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="add-button" onClick={() => navigate('/join')}>
            코드로 가입
          </button>
          <button className="add-button" onClick={() => setShowCreateModal(true)}>
            클럽 만들기
          </button>
        </div>
      </div>

      {/* 클럽 드롭다운 */}
      {myClubs.length > 0 && (
        <div className="club-dropdown-container">
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
      )}

      {/* 클럽 액션 버튼 */}
      {selectedClub && (
        <div className="club-actions">
          <button className="action-button-compact secondary" onClick={() => setShowMileageConfig(true)}>
            <Info size={14} />
            <span>계수</span>
          </button>
          <button className="action-button-compact secondary" onClick={() => setShowDetailedStats(true)}>
            <Table size={14} />
            <span>통계</span>
          </button>
          <button
            className="action-button-compact"
            onClick={(e) => copyInviteCode(selectedClub.invite_code, e)}
          >
            <Copy size={14} />
            <span>클럽초대</span>
          </button>
          <button
            className="action-button-compact"
            onClick={() => navigate(`/club/settings/${selectedClub.id}/${encodeURIComponent(selectedClub.name)}`)}
          >
            <Settings size={14} />
            <span>설정</span>
          </button>
        </div>
      )}

      {/* 클럽 랭킹 */}
      {selectedClub ? (
        <div className="club-dashboard">
          <div className="dashboard-header">
            <h2>이번 달 랭킹</h2>
          </div>

          {loading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>불러오는 중...</p>
            </div>
          ) : ranking.filter(m => m.workout_count > 0 && m.total_mileage > 0).length === 0 ? (
            <div className="empty-state">
              <p>이번 달 운동 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="ranking-list">
              {ranking.filter(m => m.workout_count > 0 && m.total_mileage > 0).map((member) => (
                <div
                  key={member.user_id}
                  className="ranking-item clickable"
                  onClick={() =>
                    navigate(
                      `/club/member/${selectedClub?.id}/${member.user_id}/${encodeURIComponent(member.display_name)}`
                    )
                  }
                >
                  <div className="ranking-left">
                    <div className={`rank-badge rank-${member.rank}`}>
                      {member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : `${member.rank}위`}
                    </div>
                    {member.profile_image ? (
                      <img
                        src={member.profile_image}
                        alt={member.display_name}
                        className="ranking-profile"
                      />
                    ) : (
                      <div className="ranking-profile-placeholder">
                        {member.display_name[0]}
                      </div>
                    )}
                    <div className="ranking-info">
                      <div className="ranking-name">{member.display_name}</div>
                      <div className="ranking-count">{member.workout_count}회 운동</div>
                    </div>
                  </div>
                  <div className="ranking-right">
                    <div className="ranking-mileage">{member.total_mileage.toFixed(1)}</div>
                    <div className="ranking-unit">마일리지</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <p>가입한 클럽이 없습니다.</p>
          <p>클럽을 만들거나 초대 코드로 가입해보세요!</p>
        </div>
      )}

      {/* 모달 */}
      {showCreateModal && (
        <CreateClubModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadMyClubs}
        />
      )}

      {showMileageConfig && selectedClub && (
        <MileageConfigModal
          config={selectedClub.mileage_config || clubService.getDefaultMileageConfig()}
          onClose={() => setShowMileageConfig(false)}
        />
      )}

      {showDetailedStats && selectedClub && (
        <ClubDetailedStatsModal
          clubId={selectedClub.id}
          clubName={selectedClub.name}
          month={{
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
          }}
          onClose={() => setShowDetailedStats(false)}
        />
      )}
    </div>
  );
};
