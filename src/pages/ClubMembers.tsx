import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Search, Shield, User, UserX, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import type { ClubMember } from '../services/clubService';

export const ClubMembers = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clubOwnerId, setClubOwnerId] = useState<string>('');

  // 명예의전당 모달 state
  const [hofModalOpen, setHofModalOpen] = useState(false);
  const [hofUserId, setHofUserId] = useState('');
  const [hofUserName, setHofUserName] = useState('');
  const [hofReason, setHofReason] = useState('');

  useEffect(() => {
    if (clubId && user) {
      loadMembers();
      checkOwnership();
    }
  }, [clubId, user]);

  const loadMembers = async () => {
    if (!clubId) return;

    setLoading(true);
    try {
      const data = await clubService.getClubMembers(clubId);
      setMembers(data);
    } catch (error) {
      console.error('클럽 멤버 조회 실패:', error);
      alert('클럽 멤버를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const checkOwnership = async () => {
    if (!clubId || !user) return;

    try {
      const club = await clubService.getClubById(clubId);
      setClubOwnerId(club.created_by);
      setIsOwner(club.created_by === user.id);
      
      // 부매니저 권한도 확인
      if (!isOwner) {
        const admin = await clubService.isClubAdmin(clubId, user.id);
        setIsAdmin(admin);
      }
    } catch (error) {
      console.error('클럽 정보 조회 실패:', error);
    }
  };

  // 검색 필터링
  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;

    const displayName = member.club_nickname || member.user?.display_name || '';
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 역할 변경
  const handleRoleChange = async (_memberId: string, userId: string, currentRole: string) => {
    if (!clubId || !isOwner) return;

    // 방장 자신은 변경 불가
    if (userId === clubOwnerId) {
      alert('방장의 역할은 변경할 수 없습니다.\n방장 위임 기능을 사용해주세요.');
      return;
    }

    const newRole = currentRole === 'vice-manager' ? 'member' : 'vice-manager';
    const roleText = newRole === 'vice-manager' ? '부매니저' : '일반 회원';

    if (!confirm(`이 회원을 ${roleText}로 변경하시겠습니까?`)) {
      return;
    }

    try {
      await clubService.updateMemberRole(clubId, userId, newRole);
      alert(`역할이 ${roleText}로 변경되었습니다.`);
      loadMembers();
    } catch (error) {
      console.error('역할 변경 실패:', error);
      alert('역할 변경에 실패했습니다.');
    }
  };

  // 회원 내보내기
  const handleRemoveMember = async (userId: string, displayName: string) => {
    if (!clubId || !isOwner) return;

    // 방장 자신은 내보낼 수 없음
    if (userId === clubOwnerId) {
      alert('방장은 내보낼 수 없습니다.');
      return;
    }

    if (!confirm(`정말로 "${displayName}" 회원을 내보내시겠습니까?`)) {
      return;
    }

    try {
      await clubService.removeMember(clubId, userId);
      alert('회원이 내보내졌습니다.');
      loadMembers();
    } catch (error) {
      console.error('회원 내보내기 실패:', error);
      alert('회원 내보내기에 실패했습니다.');
    }
  };

  // 명예의 전당 추가
  const handleAddToHOF = (userId: string, displayName: string) => {
    if (!clubId || !user || (!isOwner && !isAdmin)) return;

    // 모달 열기
    setHofUserId(userId);
    setHofUserName(displayName);
    setHofReason('');
    setHofModalOpen(true);
  };

  // 명예의전당 추가 실행
  const confirmAddToHOF = async () => {
    if (!clubId || !user || !hofUserId) return;

    if (!hofReason.trim()) {
      alert('명예의 전당에 기록할 메시지를 입력해주세요.');
      return;
    }

    try {
      await clubService.addToHallOfFame(clubId, hofUserId, user.id, hofReason.trim());
      alert('명예의 전당에 추가되었습니다! 🏆');
      setHofModalOpen(false);
      setHofReason('');
      loadMembers();
    } catch (error) {
      console.error('명예의 전당 추가 실패:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('명예의 전당 추가에 실패했습니다.');
      }
    }
  };

  // 명예의 전당 제거
  const handleRemoveFromHOF = async (userId: string, displayName: string) => {
    if (!clubId || (!isOwner && !isAdmin)) return;

    if (!confirm(`"${displayName}"님을 명예의 전당에서 제거하시겠습니까?`)) {
      return;
    }

    try {
      await clubService.removeFromHallOfFame(clubId, userId);
      alert('명예의 전당에서 제거되었습니다.');
      loadMembers();
    } catch (error) {
      console.error('명예의 전당 제거 실패:', error);
      alert('명예의 전당 제거에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>클럽원 목록</h1>
      </div>

      <div className="settings-form">
        {/* 검색 */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* 회원 수 */}
        <div className="members-count">
          총 {filteredMembers.length}명
          {searchQuery && ` (전체 ${members.length}명 중)`}
        </div>

        {/* 회원 리스트 */}
        <div className="member-list">
          {filteredMembers.length === 0 ? (
            <div className="empty-message">검색 결과가 없습니다.</div>
          ) : (
            filteredMembers.map((member) => {
              const displayName = member.club_nickname || member.user?.display_name || '알 수 없음';
              const isClubOwner = member.user_id === clubOwnerId;

              // 프로필 이미지 처리 (club_profile_image 우선)
              const profileImage = member.club_profile_image || member.user?.profile_image;
              const renderAvatar = () => {
                if (profileImage?.startsWith('default:')) {
                  const color = profileImage.replace('default:', '');
                  return (
                    <div
                      className="member-avatar-placeholder"
                      style={{ background: color, color: 'white' }}
                    >
                      {displayName[0].toUpperCase()}
                    </div>
                  );
                } else if (profileImage) {
                  return <img src={profileImage} alt={displayName} className="member-avatar" />;
                } else {
                  return (
                    <div
                      className="member-avatar-placeholder"
                      style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}
                    >
                      {displayName[0]}
                    </div>
                  );
                }
              };

              return (
                <div key={member.id} className="member-card" style={{
                  background: member.is_hall_of_fame ? 'linear-gradient(135deg, #FFF9E6 0%, #FFFAED 100%)' : undefined,
                  borderColor: member.is_hall_of_fame ? '#FFD700' : undefined,
                  borderWidth: member.is_hall_of_fame ? '2px' : undefined,
                }}>
                  <div className="member-info">
                    {renderAvatar()}
                    <div className="member-details">
                      <div className="member-name">
                        {displayName}
                        {isClubOwner && (
                          <span className="owner-badge">방장</span>
                        )}
                        {member.role === 'vice-manager' && (
                          <span className="admin-badge">부매니저</span>
                        )}
                        {member.is_hall_of_fame && (
                          <span className="hof-badge">🏆 명예의 전당</span>
                        )}
                      </div>
                      {member.club_nickname && member.user?.display_name && (isOwner || isAdmin) && (
                        <div className="member-original-name">
                          {member.user.display_name}
                        </div>
                      )}
                      {member.is_hall_of_fame && member.hof_inducted_at && (
                        <div className="member-hof-date">
                          {new Date(member.hof_inducted_at).toLocaleDateString('ko-KR')} 등재
                        </div>
                      )}
                    </div>
                  </div>

                  {(isOwner || isAdmin) && !isClubOwner && (
                    <div className="member-actions">
                      {member.is_hall_of_fame ? (
                        <button
                          className="member-action-button hof-remove"
                          onClick={() => handleRemoveFromHOF(member.user_id, displayName)}
                          title="명예의 전당에서 제거"
                        >
                          <Award size={16} />
                          <span>명전 제거</span>
                        </button>
                      ) : (
                        <button
                          className="member-action-button hof-add"
                          onClick={() => handleAddToHOF(member.user_id, displayName)}
                          title="명예의 전당에 추가"
                        >
                          <Award size={16} />
                          <span>명전 추가</span>
                        </button>
                      )}
                      <button
                        className="member-action-button secondary"
                        onClick={() => handleRoleChange(member.id, member.user_id, member.role)}
                        title={member.role === 'vice-manager' ? '일반 회원으로 변경' : '부매니저로 지정'}
                      >
                        {member.role === 'vice-manager' ? (
                          <>
                            <User size={16} />
                            <span>회원으로</span>
                          </>
                        ) : (
                          <>
                            <Shield size={16} />
                            <span>부매니저로</span>
                          </>
                        )}
                      </button>
                      <button
                        className="member-action-button danger"
                        onClick={() => handleRemoveMember(member.user_id, displayName)}
                        title="회원 내보내기"
                      >
                        <UserX size={16} />
                        <span>내보내기</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 명예의전당 추가 모달 */}
      {hofModalOpen && (
        <div className="modal-overlay" onClick={() => setHofModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏆 명예의 전당 추가</h2>
              <button className="modal-close" onClick={() => setHofModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                <strong>{hofUserName}</strong>님을 명예의 전당에 추가합니다.
              </p>
              <p className="modal-description secondary">
                명예의 전당에 기록할 메시지를 입력해주세요.
              </p>
              <textarea
                className="hof-reason-input"
                placeholder="예: 26.03~26.05 3개월 연속 마일리지 1등 달성"
                value={hofReason}
                onChange={(e) => setHofReason(e.target.value)}
                rows={3}
                maxLength={200}
              />
              <div className="modal-footer">
                <button className="button-secondary" onClick={() => setHofModalOpen(false)}>
                  취소
                </button>
                <button className="button-primary" onClick={confirmAddToHOF}>
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
