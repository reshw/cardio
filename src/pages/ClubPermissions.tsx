import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useClubName } from '../hooks/useClubName';
import { useAuth } from '../contexts/AuthContext';
import clubService, { type ClubMember } from '../services/clubService';
import { MemberPickerSheet } from '../components/MemberPickerSheet';
import clubPermissionService, {
  type CustomRole,
  type PermissionKey,
  type RoleLabels,
  DEFAULT_ROLE_LABELS,
  PERMISSION_LABELS,
} from '../services/clubPermissionService';

const PERMISSION_KEYS: PermissionKey[] = ['manage_events'];

export const ClubPermissions = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLabels, setRoleLabels] = useState<RoleLabels>(DEFAULT_ROLE_LABELS);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [savingLabels, setSavingLabels] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [clubOwnerId, setClubOwnerId] = useState('');
  const [showVicePicker, setShowVicePicker] = useState(false);

  const load = async () => {
    if (!clubId || !user) return;
    setLoading(true);
    try {
      const admin = await clubService.isClubAdmin(clubId, user.id);
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }
      const [labels, roles, memberList, club] = await Promise.all([
        clubPermissionService.getRoleLabels(clubId),
        clubPermissionService.listCustomRoles(clubId),
        clubService.getClubMembers(clubId),
        clubService.getClubById(clubId),
      ]);
      setRoleLabels(labels);
      setCustomRoles(roles);
      setMembers(memberList);
      setClubOwnerId(club.created_by);
      setErrorMsg(null);
    } catch (err: any) {
      console.error('[권한관리] 초기 로드 실패:', JSON.stringify(err), err);
      setErrorMsg(err?.message || err?.error_description || err?.hint || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, user]);

  const handleSaveLabels = async () => {
    if (!clubId) return;
    setSavingLabels(true);
    try {
      await clubPermissionService.updateRoleLabels(clubId, roleLabels);
    } catch (err: any) {
      console.error('[권한관리] 등급 이름 저장 실패:', JSON.stringify(err), err);
      alert(`저장 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    } finally {
      setSavingLabels(false);
    }
  };

  const handleAddRole = async () => {
    if (!clubId || !user) return;
    const name = newRoleName.trim();
    if (!name) return;
    try {
      await clubPermissionService.createCustomRole({
        clubId,
        createdBy: user.id,
        name,
        sortOrder: customRoles.length,
      });
      setNewRoleName('');
      setAddingRole(false);
      load();
    } catch (err: any) {
      console.error('[권한관리] 등급 추가 실패:', JSON.stringify(err), err);
      alert(`등급 추가 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  const handlePromoteToViceManager = async (userId: string) => {
    if (!clubId) return;
    try {
      await clubService.updateMemberRole(clubId, userId, 'vice-manager');
      load();
    } catch (err: any) {
      console.error('[권한관리] 부클럽장 지정 실패:', JSON.stringify(err), err);
      alert(`지정 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  const handleDemoteViceManager = async (userId: string) => {
    if (!clubId) return;
    try {
      await clubService.updateMemberRole(clubId, userId, 'member');
      load();
    } catch (err: any) {
      console.error('[권한관리] 부클럽장 해제 실패:', JSON.stringify(err), err);
      alert(`해제 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  const handleDeleteRole = async (role: CustomRole) => {
    if (!confirm(`"${role.name}" 등급을 삭제할까요? 소속 멤버 배정도 함께 사라집니다.`)) return;
    try {
      await clubPermissionService.deleteCustomRole(role.id);
      load();
    } catch (err: any) {
      console.error('[권한관리] 등급 삭제 실패:', JSON.stringify(err), err);
      alert(`삭제 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  const handleTogglePermission = async (role: CustomRole, key: PermissionKey) => {
    const has = role.permissions.includes(key);
    const next = has ? role.permissions.filter((p) => p !== key) : [...role.permissions, key];
    try {
      await clubPermissionService.updateCustomRole(role.id, { permissions: next });
      load();
    } catch (err: any) {
      console.error('[권한관리] 권한 변경 실패:', JSON.stringify(err), err);
      alert(`변경 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  const handleRenameRole = async (role: CustomRole, name: string) => {
    if (!name.trim() || name === role.name) return;
    try {
      await clubPermissionService.updateCustomRole(role.id, { name: name.trim() });
      load();
    } catch (err: any) {
      console.error('[권한관리] 등급 이름 변경 실패:', JSON.stringify(err), err);
      alert(`변경 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  const handleAddMember = async (role: CustomRole, userId: string) => {
    try {
      await clubPermissionService.addRoleMember(role.id, userId);
      load();
    } catch (err: any) {
      console.error('[권한관리] 멤버 추가 실패:', JSON.stringify(err), err);
      alert(`추가 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  const handleRemoveMember = async (role: CustomRole, userId: string) => {
    try {
      await clubPermissionService.removeRoleMember(role.id, userId);
      load();
    } catch (err: any) {
      console.error('[권한관리] 멤버 제거 실패:', JSON.stringify(err), err);
      alert(`제거 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-screen"><div className="spinner"></div></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <button className="back-button" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
          <h1>권한 및 호칭관리</h1>
        </div>
        <div className="empty-state"><p>운영진만 접근할 수 있습니다.</p></div>
      </div>
    );
  }

  const managerMembers = members.filter((m) => m.role === 'manager');
  const viceManagerMembers = members.filter((m) => m.role === 'vice-manager');

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>권한 및 호칭관리</h1>
        </div>
      </div>

      <div className="settings-content" style={{ padding: 16 }}>
        {errorMsg && (
          <div className="empty-state" style={{ marginBottom: 16 }}>
            <p>불러오는 중 오류: {errorMsg}</p>
          </div>
        )}

        <div className="permission-role-tier">
          <div className="permission-role-tier-header">
            <input
              className="permission-role-name-input"
              value={roleLabels.manager}
              onChange={(e) => setRoleLabels({ ...roleLabels, manager: e.target.value })}
              maxLength={20}
            />
          </div>
          <div className="permission-role-member-names">
            {managerMembers.map((m) => m.club_nickname || m.user?.display_name || '회원').join(', ') || '없음'}
          </div>
        </div>

        <div className="permission-role-tier">
          <div className="permission-role-tier-header">
            <input
              className="permission-role-name-input"
              value={roleLabels['vice-manager']}
              onChange={(e) => setRoleLabels({ ...roleLabels, 'vice-manager': e.target.value })}
              maxLength={20}
            />
            <button type="button" className="permission-role-icon-btn" onClick={() => setShowVicePicker(true)} title="멤버 추가">
              <UserPlus size={16} />
            </button>
          </div>

          <div className="permission-member-chip-row" style={{ marginTop: 8 }}>
            {viceManagerMembers.map((m) => (
              <span key={m.user_id} className="permission-member-chip">
                {m.club_nickname || m.user?.display_name || '회원'}
                <button type="button" onClick={() => handleDemoteViceManager(m.user_id)}><X size={12} /></button>
              </span>
            ))}
            {viceManagerMembers.length === 0 && <span className="empty-message">없음</span>}
          </div>
        </div>

        {showVicePicker && (
          <MemberPickerSheet
            title={`${roleLabels['vice-manager']} 지정`}
            members={members}
            excludeUserIds={new Set([...members.filter((m) => m.role !== 'member').map((m) => m.user_id), clubOwnerId])}
            onSelect={handlePromoteToViceManager}
            onClose={() => setShowVicePicker(false)}
          />
        )}

        <div className="permission-custom-role-list">
          {customRoles.map((role) => (
            <CustomRoleCard
              key={role.id}
              role={role}
              members={members}
              onRename={(name) => handleRenameRole(role, name)}
              onTogglePermission={(key) => handleTogglePermission(role, key)}
              onAddMember={(userId) => handleAddMember(role, userId)}
              onRemoveMember={(userId) => handleRemoveMember(role, userId)}
              onDelete={() => handleDeleteRole(role)}
            />
          ))}

          {addingRole ? (
            <div className="permission-add-role-form">
              <input
                className="search-input"
                placeholder="등급 이름 (예: 행사분과장)"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                autoFocus
              />
              <div className="permission-add-role-actions">
                <button type="button" className="event-detail-action-btn" onClick={() => { setAddingRole(false); setNewRoleName(''); }}>취소</button>
                <button type="button" className="event-detail-action-btn" onClick={handleAddRole}>추가</button>
              </div>
            </div>
          ) : (
            <button type="button" className="permission-add-role-btn" onClick={() => setAddingRole(true)}>
              <Plus size={16} /> 등급 추가
            </button>
          )}
        </div>

        <div className="permission-role-tier">
          <div className="permission-role-tier-header">
            <input
              className="permission-role-name-input"
              value={roleLabels.member}
              onChange={(e) => setRoleLabels({ ...roleLabels, member: e.target.value })}
              maxLength={20}
            />
          </div>
        </div>

        <button
          type="button"
          className="challenge-create-submit"
          style={{ marginTop: 16 }}
          disabled={savingLabels}
          onClick={handleSaveLabels}
        >
          {savingLabels ? '저장 중...' : '등급 이름 저장'}
        </button>
      </div>
    </div>
  );
};

function CustomRoleCard({
  role,
  members,
  onRename,
  onTogglePermission,
  onAddMember,
  onRemoveMember,
  onDelete,
}: {
  role: CustomRole;
  members: ClubMember[];
  onRename: (name: string) => void;
  onTogglePermission: (key: PermissionKey) => void;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="permission-custom-role-card">
      <div className="permission-role-tier-header">
        <input
          className="permission-role-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => onRename(name)}
          maxLength={20}
        />
        <button type="button" className="permission-role-icon-btn" onClick={() => setShowPicker(true)} title="멤버 추가">
          <UserPlus size={16} />
        </button>
        <button type="button" className="permission-role-icon-btn" onClick={onDelete} title="등급 삭제">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="permission-checkbox-row">
        {PERMISSION_KEYS.map((key) => (
          <label key={key} className="permission-checkbox-label">
            <input
              type="checkbox"
              checked={role.permissions.includes(key)}
              onChange={() => onTogglePermission(key)}
            />
            {PERMISSION_LABELS[key]}
          </label>
        ))}
      </div>

      <div className="permission-member-chip-row">
        {role.members.map((m) => (
          <span key={m.user_id} className="permission-member-chip">
            {m.nickname}
            <button type="button" onClick={() => onRemoveMember(m.user_id)}><X size={12} /></button>
          </span>
        ))}
        {role.members.length === 0 && <span className="empty-message">배정된 멤버 없음</span>}
      </div>

      {showPicker && (
        <MemberPickerSheet
          title={`${role.name} 멤버 추가`}
          members={members}
          excludeUserIds={new Set(role.members.map((m) => m.user_id))}
          onSelect={onAddMember}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
