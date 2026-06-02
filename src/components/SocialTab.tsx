import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, ExternalLink } from 'lucide-react';
import socialPointService, { getActionIcon, getActionLabel, type SocialLeaderboardEntry, type SocialMyStats } from '../services/socialPointService';
import socialGatheringService, { type GatheringMember } from '../services/socialGatheringService';

interface Props {
  clubId: string;
  userId: string;
  isAdmin: boolean;
  selectedMonth: Date;
}

type SocialSubTab = 'myrank' | 'all';

export const SocialTab: React.FC<Props> = ({ clubId, userId, isAdmin, selectedMonth }) => {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState<SocialSubTab>('myrank');
  const [myStats, setMyStats] = useState<SocialMyStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<SocialLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGatheringModal, setShowGatheringModal] = useState(false);

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth() + 1;

  useEffect(() => {
    loadData();
  }, [clubId, userId, year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stats, board] = await Promise.all([
        socialPointService.getMyStats(clubId, userId, year, month),
        socialPointService.getMonthlyLeaderboard(clubId, year, month),
      ]);
      setMyStats(stats);
      setLeaderboard(board);
    } catch (e) {
      console.error('소셜 데이터 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>소셜 포인트 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="social-tab-container">
      {/* 서브탭 */}
      <div className="ranking-filter-tabs">
        <button className={`filter-tab ${subTab === 'myrank' ? 'active' : ''}`} onClick={() => setSubTab('myrank')}>내순위</button>
        <button className={`filter-tab ${subTab === 'all' ? 'active' : ''}`} onClick={() => setSubTab('all')}>전체</button>
      </div>

      {subTab === 'myrank' && myStats && (
        <div>
          {/* 내 요약 카드 */}
          <div className="social-summary-card">
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>이번 달 소셜 포인트</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>🤝 {myStats.total_points}점</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{myStats.rank}위</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>전체 {leaderboard.length}명 중</div>
            </div>
          </div>

          {/* 소모임 신청 버튼 */}
          <button className="social-gather-btn" onClick={() => setShowGatheringModal(true)}>
            <Plus size={16} />
            소모임 인증 신청
          </button>

          {/* 내 포인트 내역 */}
          {myStats.history.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 24 }}>
              <p>이번 달 소셜 포인트 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="social-history-list">
              {myStats.history.map(item => (
                <div key={item.id} className="social-history-item">
                  <span className="social-history-icon">{getActionIcon(item.action_type)}</span>
                  <div style={{ flex: 1 }}>
                    <div className="social-history-label">{getActionLabel(item.action_type)}</div>
                    {item.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.description}</div>}
                  </div>
                  {item.memo_url && (
                    <a href={item.memo_url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>
                      <ExternalLink size={14} color="var(--text-secondary)" />
                    </a>
                  )}
                  <div style={{ textAlign: 'right' }}>
                    <div className="social-history-pts">+{item.points}</div>
                    <div className="social-history-date">{formatDate(item.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'all' && (
        <div>
          {leaderboard.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 24 }}>
              <p>이번 달 소셜 포인트 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="ranking-list">
              {leaderboard.map(entry => {
                const isMe = entry.user_id === userId;
                return (
                  <div key={entry.user_id} className={`ranking-item${isMe ? ' my-rank-context-row--me' : ''}`}>
                    <div className="ranking-rank">{entry.rank}</div>
                    <div className="ranking-profile-placeholder" style={{ background: 'linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%)', minWidth: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>
                      {entry.nickname[0]}
                    </div>
                    <div className="ranking-info">
                      <div className="ranking-name">{entry.nickname}{isMe && <span style={{ fontSize: 11, color: 'var(--primary-color)', marginLeft: 4 }}>나</span>}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary-color)' }}>{entry.total_points}점</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 관리자 링크 */}
      {isAdmin && (
        <button
          className="settings-menu-item"
          style={{ marginTop: 24, borderRadius: 12 }}
          onClick={() => navigate(`/club/settings/${clubId}/social`)}
        >
          <span>소셜 포인트 관리</span>
          <ChevronRight size={16} />
        </button>
      )}

      {/* 소모임 신청 모달 */}
      {showGatheringModal && (
        <GatheringModal
          clubId={clubId}
          userId={userId}
          onClose={() => setShowGatheringModal(false)}
          onSuccess={() => { setShowGatheringModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

// 소모임 신청 모달
const GatheringModal: React.FC<{
  clubId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ clubId, userId, onClose, onSuccess }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GatheringMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<GatheringMember[]>([]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    const results = await socialGatheringService.searchClubMembers(clubId, q);
    setSearchResults(results.filter(r => r.user_id !== userId && !selectedMembers.find(m => m.user_id === r.user_id)));
  };

  const addMember = (member: GatheringMember) => {
    setSelectedMembers(prev => [...prev, member]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMember = (userId: string) => {
    setSelectedMembers(prev => prev.filter(m => m.user_id !== userId));
  };

  const handleSubmit = async () => {
    if (selectedMembers.length < 2) {
      alert('본인 포함 3인 이상이어야 합니다. 다른 참가자를 2명 이상 추가해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await socialGatheringService.createGathering({
        clubId,
        createdBy: userId,
        memberUserIds: selectedMembers.map(m => m.user_id),
        description: description || undefined,
      });
      alert('소모임 신청이 완료됐습니다. 운영진 승인 후 포인트가 지급됩니다.');
      onSuccess();
    } catch (e) {
      alert('신청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '90%' }}>
        <div className="modal-header">
          <h2>소모임 인증 신청</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            본인 포함 3인 이상이 모여야 합니다. 함께한 멤버를 닉네임으로 검색해서 추가하세요.
          </p>

          {/* 선택된 멤버 */}
          {selectedMembers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {selectedMembers.map(m => (
                <div key={m.user_id} style={{ background: 'var(--primary-bg)', borderRadius: 20, padding: '4px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.nickname}
                  <button onClick={() => removeMember(m.user_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* 검색 */}
          <input
            className="search-input"
            placeholder="닉네임으로 검색"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          {searchResults.length > 0 && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {searchResults.map(r => (
                <button
                  key={r.user_id}
                  onClick={() => addMember(r)}
                  style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 14 }}
                >
                  {r.nickname}
                </button>
              ))}
            </div>
          )}

          {/* 설명 */}
          <textarea
            className="search-input"
            placeholder="간단한 모임 설명 (선택)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            style={{ marginBottom: 16, resize: 'none' }}
          />

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            참가자: 나 + {selectedMembers.length}명 = 총 {selectedMembers.length + 1}명
            {selectedMembers.length < 2 && <span style={{ color: 'var(--danger-color)' }}> (3인 이상 필요)</span>}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleSubmit}
            disabled={submitting || selectedMembers.length < 2}
          >
            {submitting ? '신청 중...' : '신청하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
