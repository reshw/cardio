import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Search, Shield, User, UserX } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [clubOwnerId, setClubOwnerId] = useState<string>('');

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

    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const roleText = newRole === 'admin' ? '부매니저' : '일반 회원';

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
        <h1>클럽원 관리</h1>
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

              return (
                <div key={member.id} className="member-card">
                  <div className="member-info">
                    {member.user?.profile_image ? (
                      <img
                        src={member.user.profile_image}
                        alt={displayName}
                        className="member-avatar"
                      />
                    ) : (
                      <div className="member-avatar-placeholder">
                        {displayName[0]}
                      </div>
                    )}
                    <div className="member-details">
                      <div className="member-name">
                        {displayName}
                        {isClubOwner && (
                          <span className="owner-badge">방장</span>
                        )}
                        {member.role === 'admin' && !isClubOwner && (
                          <span className="admin-badge">부매니저</span>
                        )}
                      </div>
                      {member.club_nickname && member.user?.display_name && (
                        <div className="member-original-name">
                          {member.user.display_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {isOwner && !isClubOwner && (
                    <div className="member-actions">
                      <button
                        className="member-action-button secondary"
                        onClick={() => handleRoleChange(member.id, member.user_id, member.role)}
                        title={member.role === 'admin' ? '일반 회원으로 변경' : '부매니저로 지정'}
                      >
                        {member.role === 'admin' ? (
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
    </div>
  );
};
