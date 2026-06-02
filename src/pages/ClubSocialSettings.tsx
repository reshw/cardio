import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import socialPointService, { getActionIcon, type SocialActionType } from '../services/socialPointService';
import socialGatheringService, { type SocialGathering, type GatheringMember } from '../services/socialGatheringService';

const MANUAL_ACTION_TYPES: { type: SocialActionType; label: string; points: number; hasUrl: boolean }[] = [
  { type: 'cafe_post', label: '카페 글 작성', points: 5, hasUrl: true },
  { type: 'training', label: 'LSD / 인터벌훈련 참가', points: 5, hasUrl: false },
  { type: 'referral', label: '신규회원 초대', points: 5, hasUrl: false },
  { type: 'donation', label: '기부금 납입', points: 1, hasUrl: false },
  { type: 'gathering', label: '소모임 수동 지급', points: 1, hasUrl: false },
];

export const ClubSocialSettings: React.FC = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pendingGatherings, setPendingGatherings] = useState<SocialGathering[]>([]);
  const [clubMembers, setClubMembers] = useState<GatheringMember[]>([]);

  // 수동 지급 폼
  const [awardMode, setAwardMode] = useState<'single' | 'bulk'>('single');
  const [selectedActionType, setSelectedActionType] = useState<SocialActionType>('cafe_post');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GatheringMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<GatheringMember | null>(null);
  const [selectedBulkMembers, setSelectedBulkMembers] = useState<Set<string>>(new Set());
  const [memoUrl, setMemoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [customPoints, setCustomPoints] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (clubId && user) loadData();
  }, [clubId, user]);

  const loadData = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const [gatherings, members] = await Promise.all([
        socialGatheringService.getPendingGatherings(clubId),
        socialGatheringService.searchClubMembers(clubId, ''),
      ]);
      setPendingGatherings(gatherings);
      setClubMembers(members);
    } catch (e) {
      console.error('데이터 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!clubId || q.length < 1) { setSearchResults([]); return; }
    const results = await socialGatheringService.searchClubMembers(clubId, q);
    setSearchResults(results);
  };

  const handleApproveGathering = async (gatheringId: string) => {
    if (!user) return;
    try {
      await socialGatheringService.approveGathering(gatheringId, user.id);
      setPendingGatherings(prev => prev.filter(g => g.id !== gatheringId));
      alert('소모임이 승인됐습니다. 참가자 전원에게 +1 지급됐습니다.');
    } catch (e: any) {
      alert(e.message || '승인에 실패했습니다.');
    }
  };

  const handleRejectGathering = async (gatheringId: string) => {
    if (!user) return;
    if (!window.confirm('소모임 신청을 거절하시겠습니까?')) return;
    try {
      await socialGatheringService.rejectGathering(gatheringId, user.id);
      setPendingGatherings(prev => prev.filter(g => g.id !== gatheringId));
    } catch (e) {
      alert('처리에 실패했습니다.');
    }
  };

  const handleAwardSingle = async () => {
    if (!clubId || !user || !selectedMember) return;
    const actionConfig = MANUAL_ACTION_TYPES.find(a => a.type === selectedActionType)!;
    const points = actionConfig.type === 'donation'
      ? (customPoints ?? 1)
      : actionConfig.points;

    setSubmitting(true);
    try {
      await socialPointService.awardPoints({
        adminId: user.id,
        clubId,
        userId: selectedMember.user_id,
        actionType: selectedActionType,
        points,
        description: description || undefined,
        memoUrl: memoUrl || undefined,
      });
      alert(`${selectedMember.nickname}님에게 +${points}점 지급 완료`);
      setSelectedMember(null);
      setMemoUrl('');
      setDescription('');
      setCustomPoints(null);
    } catch (e) {
      alert('지급에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAwardBulk = async () => {
    if (!clubId || !user || selectedBulkMembers.size === 0) return;
    if (!window.confirm(`${selectedBulkMembers.size}명에게 훈련 참가 +5점을 일괄 지급하시겠습니까?`)) return;

    setSubmitting(true);
    try {
      await socialPointService.awardBulkTraining({
        adminId: user.id,
        clubId,
        userIds: Array.from(selectedBulkMembers),
        description: description || undefined,
      });
      alert(`${selectedBulkMembers.size}명에게 일괄 지급 완료`);
      setSelectedBulkMembers(new Set());
      setDescription('');
    } catch (e) {
      alert('지급에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBulkMember = (userId: string) => {
    setSelectedBulkMembers(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen"><div className="spinner" /><p>불러오는 중...</p></div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <h1>소셜 포인트 관리</h1>
      </div>

      {/* 소모임 승인 큐 */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', padding: '0 16px' }}>
          소모임 승인 대기 {pendingGatherings.length > 0 && <span style={{ color: 'var(--primary-color)' }}>({pendingGatherings.length})</span>}
        </h2>
        {pendingGatherings.length === 0 ? (
          <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>대기 중인 소모임이 없습니다.</div>
        ) : (
          <div className="settings-menu">
            {pendingGatherings.map(g => (
              <div key={g.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{g.creator_nickname} 외 {(g.members?.length ?? 1) - 1}명</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {g.gathered_at} · 총 {g.members?.length ?? 0}명
                    </div>
                    {g.description && <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-color)' }}>{g.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleApproveGathering(g.id)}
                      style={{ background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                    >
                      <Check size={14} /> 승인
                    </button>
                    <button
                      onClick={() => handleRejectGathering(g.id)}
                      style={{ background: 'var(--border-color)', color: 'var(--text-color)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                    >
                      <X size={14} /> 거절
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 수동 포인트 지급 */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', padding: '0 16px' }}>수동 포인트 지급</h2>
        <div style={{ padding: '0 16px' }}>

          {/* 단일 / 일괄 토글 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setAwardMode('single')}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${awardMode === 'single' ? 'var(--primary-color)' : 'var(--border-color)'}`, background: awardMode === 'single' ? 'var(--primary-bg)' : 'transparent', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
            >
              개별 지급
            </button>
            <button
              onClick={() => setAwardMode('bulk')}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${awardMode === 'bulk' ? 'var(--primary-color)' : 'var(--border-color)'}`, background: awardMode === 'bulk' ? 'var(--primary-bg)' : 'transparent', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
            >
              훈련 출결 일괄
            </button>
          </div>

          {awardMode === 'single' && (
            <div>
              {/* 행동 유형 선택 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {MANUAL_ACTION_TYPES.filter(a => a.type !== 'training').map(a => (
                  <button
                    key={a.type}
                    onClick={() => setSelectedActionType(a.type)}
                    style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${selectedActionType === a.type ? 'var(--primary-color)' : 'var(--border-color)'}`, background: selectedActionType === a.type ? 'var(--primary-bg)' : 'transparent', fontSize: 13, cursor: 'pointer', fontWeight: selectedActionType === a.type ? 700 : 400 }}
                  >
                    {getActionIcon(a.type)} {a.label}
                  </button>
                ))}
              </div>

              {/* 회원 검색 */}
              {!selectedMember ? (
                <div style={{ marginBottom: 12 }}>
                  <input
                    className="search-input"
                    placeholder="닉네임으로 검색"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                  {searchResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
                      {searchResults.map(r => (
                        <button
                          key={r.user_id}
                          onClick={() => { setSelectedMember(r); setSearchQuery(''); setSearchResults([]); }}
                          style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 14 }}
                        >
                          {r.nickname}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: 'var(--primary-bg)', padding: '8px 12px', borderRadius: 8 }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{selectedMember.nickname}</span>
                  <button onClick={() => setSelectedMember(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                </div>
              )}

              {/* 기부금 점수 직접 입력 */}
              {selectedActionType === 'donation' && (
                <input
                  type="number"
                  className="search-input"
                  placeholder="지급 점수 (1만원당 1점)"
                  value={customPoints ?? ''}
                  onChange={e => setCustomPoints(Number(e.target.value))}
                  style={{ marginBottom: 8 }}
                />
              )}

              {/* 카페 URL 메모 */}
              {MANUAL_ACTION_TYPES.find(a => a.type === selectedActionType)?.hasUrl && (
                <input
                  className="search-input"
                  placeholder="카페 글 URL (선택)"
                  value={memoUrl}
                  onChange={e => setMemoUrl(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              )}

              <input
                className="search-input"
                placeholder="메모 (선택)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ marginBottom: 12 }}
              />

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleAwardSingle}
                disabled={submitting || !selectedMember}
              >
                {submitting ? '지급 중...' : `+${MANUAL_ACTION_TYPES.find(a => a.type === selectedActionType)?.points ?? customPoints ?? 1}점 지급`}
              </button>
            </div>
          )}

          {awardMode === 'bulk' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                훈련 참가자를 선택하면 전원에게 +5점이 일괄 지급됩니다.
              </p>
              <input
                className="search-input"
                placeholder="메모 (예: 5/31 LSD 한강)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, marginBottom: 12 }}>
                {clubMembers.map(m => (
                  <button
                    key={m.user_id}
                    onClick={() => toggleBulkMember(m.user_id)}
                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: selectedBulkMembers.has(m.user_id) ? 'var(--primary-bg)' : 'none', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selectedBulkMembers.has(m.user_id) ? 'var(--primary-color)' : 'var(--border-color)'}`, background: selectedBulkMembers.has(m.user_id) ? 'var(--primary-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedBulkMembers.has(m.user_id) && <Check size={12} color="white" />}
                    </div>
                    {m.nickname}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                {selectedBulkMembers.size}명 선택됨
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleAwardBulk}
                disabled={submitting || selectedBulkMembers.size === 0}
              >
                {submitting ? '지급 중...' : `${selectedBulkMembers.size}명에게 +5점 일괄 지급`}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
