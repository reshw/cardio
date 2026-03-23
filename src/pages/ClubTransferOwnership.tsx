import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import type { ClubMember } from '../services/clubService';

export const ClubTransferOwnership = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId && user) {
      loadMembers();
    }
  }, [clubId, user]);

  const loadMembers = async () => {
    if (!clubId || !user) return;

    setLoading(true);
    try {
      const allMembers = await clubService.getClubMembers(clubId);
      // 현재 사용자를 제외한 멤버들만 표시
      const otherMembers = allMembers.filter((m) => m.user_id !== user.id);
      setMembers(otherMembers);
    } catch (error) {
      console.error('멤버 조회 실패:', error);
      alert('멤버 목록을 불러올 수 없습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!clubId || !user || !selectedMember) {
      alert('위임할 멤버를 선택해주세요.');
      return;
    }

    const selectedMemberData = members.find((m) => m.user_id === selectedMember);
    const memberName = selectedMemberData?.user?.display_name || '선택한 멤버';

    if (
      !confirm(
        `정말로 "${memberName}"에게 클럽장을 위임하시겠습니까?\n\n위임 후에는 일반 멤버로 전환되며, 클럽 관리 권한을 잃게 됩니다.`
      )
    ) {
      return;
    }

    setTransferring(true);

    try {
      await clubService.transferClubOwnership(clubId, user.id, selectedMember);
      alert('클럽장이 위임되었습니다.');
      navigate('/club');
    } catch (error) {
      console.error('클럽장 위임 실패:', error);
      alert('클럽장 위임에 실패했습니다.');
    } finally {
      setTransferring(false);
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
        <h1>클럽장 위임</h1>
      </div>

      <div className="settings-form">
        <p className="form-hint" style={{ marginBottom: '20px' }}>
          클럽장을 위임할 멤버를 선택해주세요. 위임 후에는 일반 멤버로 전환됩니다.
        </p>

        {members.length === 0 ? (
          <div className="empty-state">
            <p>클럽에 다른 멤버가 없습니다.</p>
            <p>클럽장을 위임하려면 먼저 멤버를 초대해주세요.</p>
          </div>
        ) : (
          <>
            <div className="member-select-list">
              {members.map((member) => {
                // 프로필 이미지 처리 (club_profile_image 우선)
                const profileImage = member.club_profile_image || member.user?.profile_image;
                const displayName = member.user?.display_name || '?';
                const renderAvatar = () => {
                  if (profileImage?.startsWith('default:')) {
                    const color = profileImage.replace('default:', '');
                    return (
                      <div
                        className="member-select-profile-placeholder"
                        style={{ background: color, color: 'white' }}
                      >
                        {displayName[0].toUpperCase()}
                      </div>
                    );
                  } else if (profileImage) {
                    return (
                      <img
                        src={profileImage}
                        alt={displayName}
                        className="member-select-profile"
                      />
                    );
                  } else {
                    return (
                      <div
                        className="member-select-profile-placeholder"
                        style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)' }}
                      >
                        {displayName[0]}
                      </div>
                    );
                  }
                };

                return (
                  <div
                    key={member.user_id}
                    className={`member-select-item ${selectedMember === member.user_id ? 'selected' : ''}`}
                    onClick={() => setSelectedMember(member.user_id)}
                  >
                    {renderAvatar()}
                    <div className="member-select-info">
                      <div className="member-select-name">{displayName}</div>
                      <div className="member-select-role">
                        {member.role === 'manager' ? '방장' : member.role === 'vice-manager' ? '부매니저' : '멤버'}
                      </div>
                    </div>
                    <div className="member-select-radio">
                      {selectedMember === member.user_id && <div className="radio-checked" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="primary-button-full"
              onClick={handleTransfer}
              disabled={!selectedMember || transferring}
              style={{ marginTop: '20px' }}
            >
              {transferring ? '위임 중...' : '클럽장 위임하기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
