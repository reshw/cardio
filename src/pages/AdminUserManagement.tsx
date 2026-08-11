import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Search, Trash2, Shield, ShieldOff, Settings, X } from 'lucide-react';
import userService from '../services/userService';
import type { User } from '../services/userService';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useModalHistory } from '../hooks/useModalHistory';

export const AdminUserManagement = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminToggleTarget, setAdminToggleTarget] = useState<User | null>(null);
  const [subAdminToggleTarget, setSubAdminToggleTarget] = useState<User | null>(null);
  const [actionMenuUser, setActionMenuUser] = useState<User | null>(null);
  useModalHistory(actionMenuUser !== null, () => setActionMenuUser(null));

  useModalHistory(showDeleteConfirm, () => setShowDeleteConfirm(false));

  useEffect(() => {
    // 슈퍼어드민 권한 확인
    if (!currentUser?.is_super_admin) {
      alert('슈퍼어드민만 접근할 수 있습니다.');
      navigate('/admin');
      return;
    }
    loadUsers();
  }, [currentUser, navigate]);

  useEffect(() => {
    // 검색 필터링
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (u) =>
          u.display_name.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.phone_number?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAllUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      console.error('회원 목록 조회 실패:', error);
      alert('회원 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setDeleting(true);
    try {
      await userService.deleteUserAsAdmin(selectedUser.id);

      alert(
        `${selectedUser.display_name}님이 삭제되었습니다.\n\n✅ users 테이블에서 삭제됨\n✅ 다음 로그인 시 자동으로 재가입됨`
      );
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('회원 삭제 실패:', error);
      alert('회원 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleAdmin = (user: User) => {
    if (user.is_super_admin) {
      alert('슈퍼어드민은 권한을 변경할 수 없습니다.');
      return;
    }
    setAdminToggleTarget(user);
  };

  const confirmToggleAdmin = async () => {
    const user = adminToggleTarget;
    setAdminToggleTarget(null);
    if (!user) return;

    const newStatus = !user.is_admin;
    const action = newStatus ? '지정' : '해제';
    try {
      await userService.setAdmin(user.id, newStatus);
      alert(`어드민 ${action}이 완료되었습니다.`);
      loadUsers();
    } catch (error) {
      console.error('어드민 설정 실패:', error);
      alert('어드민 설정에 실패했습니다.');
    }
  };

  const handleToggleSubAdmin = (user: User) => {
    if (user.is_admin || user.is_super_admin) {
      alert('어드민은 부어드민 설정을 변경할 수 없습니다.');
      return;
    }
    setSubAdminToggleTarget(user);
  };

  const confirmToggleSubAdmin = async () => {
    const user = subAdminToggleTarget;
    setSubAdminToggleTarget(null);
    if (!user) return;

    const newStatus = !user.is_sub_admin;
    const action = newStatus ? '지정' : '해제';
    try {
      await userService.setSubAdmin(user.id, newStatus);
      alert(`부어드민 ${action}이 완료되었습니다.`);
      loadUsers();
    } catch (error) {
      console.error('부어드민 설정 실패:', error);
      alert('부어드민 설정에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date
      .getDate()
      .toString()
      .padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>회원 목록 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate('/admin')}>
          <ChevronLeft size={24} />
        </button>
        <h1>회원 관리</h1>
      </div>

      <div className="settings-content">
        {/* 검색 바 */}
        <div className="search-section" style={{ marginBottom: '20px' }}>
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="이름, 이메일, 전화번호로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* 통계 */}
        <div className="stats-row" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-label">전체 회원</div>
            <div className="stat-value">{users.length}명</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">검색 결과</div>
            <div className="stat-value">{filteredUsers.length}명</div>
          </div>
        </div>

        {/* 회원 목록 */}
        <div className="settings-section">
          <h2 style={{ marginBottom: '16px' }}>회원 목록</h2>
          {filteredUsers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}
            </p>
          ) : (
            <div className="user-list">
              {filteredUsers.map((user) => (
                <div key={user.id} className="user-item">
                  <div className="user-info">
                    <div className="user-name">
                      {user.display_name}
                      {user.is_super_admin && (
                        <span className="badge badge-super-admin">슈퍼어드민</span>
                      )}
                      {user.is_admin && !user.is_super_admin && (
                        <span className="badge badge-admin">어드민</span>
                      )}
                      {user.is_sub_admin && !user.is_admin && (
                        <span className="badge badge-sub-admin">부어드민</span>
                      )}
                    </div>
                    <div className="user-details">
                      {user.email && <span>📧 {user.email}</span>}
                      {user.phone_number && <span>📱 {user.phone_number}</span>}
                    </div>
                    <div className="user-meta">
                      가입일: {formatDate(user.created_at)}
                    </div>
                  </div>

                  <div className="user-actions">
                    <button
                      className="btn-icon"
                      onClick={() => setActionMenuUser(user)}
                      title="회원 관리"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && selectedUser && createPortal(
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>회원 강제 탈퇴</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, lineHeight: 1.6 }}>
                <strong>{selectedUser.display_name}</strong>님을 강제 탈퇴시키시겠습니까?
              </p>
              <div
                style={{
                  background: 'var(--warning-tint)',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 20,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                <strong>⚠️ 주의사항</strong>
                <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                  <li>모든 운동 기록이 삭제됩니다</li>
                  <li>클럽 멤버십이 해제됩니다</li>
                  <li>다시 로그인하면 자동으로 재가입됩니다</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  취소
                </button>
                <button
                  className="btn-danger"
                  style={{ flex: 1 }}
                  onClick={handleDeleteUser}
                  disabled={deleting}
                >
                  {deleting ? '삭제 중...' : '강제 탈퇴'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {actionMenuUser && createPortal(
        <div className="cmenu-overlay" onClick={() => setActionMenuUser(null)}>
          <div className="cmenu-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cmenu-handle" />
            <div className="cmenu-head">
              <span className="cmenu-head-title">{actionMenuUser.display_name}</span>
              <button type="button" className="cmenu-head-close" onClick={() => setActionMenuUser(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="cmenu-body">
              {(!actionMenuUser.is_super_admin || (!actionMenuUser.is_admin && !actionMenuUser.is_super_admin)) && (
                <div className="cmenu-group">
                  {!actionMenuUser.is_super_admin && (
                    <button
                      className="cmenu-row"
                      onClick={() => {
                        const u = actionMenuUser;
                        setActionMenuUser(null);
                        handleToggleAdmin(u);
                      }}
                    >
                      <Shield size={20} className="cmenu-row-icon" />
                      <div className="cmenu-row-text">
                        <div className="cmenu-row-title">{actionMenuUser.is_admin ? '어드민 해제' : '어드민 지정'}</div>
                        <div className="cmenu-row-desc">클럽 승인·운동 종목 관리 권한</div>
                      </div>
                    </button>
                  )}
                  {!actionMenuUser.is_admin && !actionMenuUser.is_super_admin && (
                    <button
                      className="cmenu-row"
                      onClick={() => {
                        const u = actionMenuUser;
                        setActionMenuUser(null);
                        handleToggleSubAdmin(u);
                      }}
                    >
                      {actionMenuUser.is_sub_admin ? (
                        <ShieldOff size={20} className="cmenu-row-icon" />
                      ) : (
                        <Shield size={20} className="cmenu-row-icon" />
                      )}
                      <div className="cmenu-row-text">
                        <div className="cmenu-row-title">
                          {actionMenuUser.is_sub_admin ? '부어드민 해제' : '부어드민 지정'}
                        </div>
                        <div className="cmenu-row-desc">제한된 관리 권한 위임</div>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {actionMenuUser.id !== currentUser?.id &&
                !actionMenuUser.is_admin &&
                !actionMenuUser.is_super_admin && (
                  <div className="cmenu-group cmenu-group--danger">
                    <button
                      className="cmenu-row cmenu-row--danger"
                      onClick={() => {
                        setSelectedUser(actionMenuUser);
                        setActionMenuUser(null);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 size={20} className="cmenu-row-icon" />
                      <div className="cmenu-row-text">
                        <div className="cmenu-row-title">강제 탈퇴</div>
                        <div className="cmenu-row-desc">운동 기록·클럽 멤버십 삭제, 재가입 가능</div>
                      </div>
                    </button>
                  </div>
                )}

              {actionMenuUser.is_super_admin && (
                <p style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
                  슈퍼어드민은 권한을 변경할 수 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={adminToggleTarget !== null}
        title="어드민 권한 변경"
        message={
          adminToggleTarget
            ? `${adminToggleTarget.display_name}님을 어드민으로 ${adminToggleTarget.is_admin ? '해제' : '지정'}하시겠습니까?\n\n어드민은 클럽 승인과 운동 종목 관리 권한을 갖게 됩니다.`
            : ''
        }
        confirmLabel={adminToggleTarget?.is_admin ? '해제' : '지정'}
        onConfirm={confirmToggleAdmin}
        onCancel={() => setAdminToggleTarget(null)}
      />

      <ConfirmDialog
        open={subAdminToggleTarget !== null}
        title="부어드민 권한 변경"
        message={
          subAdminToggleTarget
            ? `${subAdminToggleTarget.display_name}님을 부어드민으로 ${subAdminToggleTarget.is_sub_admin ? '해제' : '지정'}하시겠습니까?`
            : ''
        }
        confirmLabel={subAdminToggleTarget?.is_sub_admin ? '해제' : '지정'}
        onConfirm={confirmToggleSubAdmin}
        onCancel={() => setSubAdminToggleTarget(null)}
      />
    </div>
  );
};
