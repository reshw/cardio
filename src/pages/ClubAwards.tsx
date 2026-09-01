import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, X, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clubAwardService from '../services/clubAwardService';
import type { ClubAward } from '../services/clubAwardService';
import clubService from '../services/clubService';
import type { ClubRanking } from '../services/clubService';
import { useConfirm } from '../hooks/useConfirm';

export const ClubAwards = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [awards, setAwards] = useState<ClubAward[]>([]);
  const [ranking, setRanking] = useState<ClubRanking[]>([]);
  const [usedTags, setUsedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 추가 폼
  const [adding, setAdding] = useState(false);
  const [pickedUserId, setPickedUserId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, r, t] = await Promise.all([
        clubAwardService.getAwards(clubId, { year, month }),
        clubService.getClubRanking(clubId, { year, month }),
        clubAwardService.getUsedTags(clubId),
      ]);
      setAwards(a);
      setRanking(r);
      setUsedTags(t);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [clubId, year, month]);

  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta: number) => {
    const total = year * 12 + (month - 1) + delta;
    setYear(Math.floor(total / 12));
    setMonth((total % 12) + 1);
  };

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const resetForm = () => {
    setAdding(false);
    setPickedUserId('');
    setTags([]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!clubId || !user || !pickedUserId) return;
    setSaving(true);
    setError(null);
    try {
      await clubAwardService.upsertAward({
        clubId, year, month, userId: pickedUserId, tags, awardedBy: user.id,
      });
      resetForm();
      await load();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (award: ClubAward) => {
    if (!(await confirm(`${award.display_name}님의 ${year}년 ${month}월 시상 기록을 삭제할까요?`))) return;
    try {
      await clubAwardService.deleteAward(award.id);
      await load();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  // 이미 기록된 사람은 후보에서 빼서 중복 선택을 막는다
  const awardedIds = new Set(awards.map(a => a.user_id));
  const candidates = ranking.filter(r => !awardedIds.has(r.user_id));

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>시상 관리</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '8px 0 16px' }}>
        <button className="month-nav-button" onClick={() => shiftMonth(-1)}>‹</button>
        <span className="month-selector-label">{year}년 {String(month).padStart(2, '0')}월</span>
        <button className="month-nav-button" onClick={() => shiftMonth(1)}>›</button>
      </div>

      {error && (
        <div className="empty-state">
          <p style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /><p>불러오는 중...</p></div>
      ) : (
        <>
          {awards.length === 0 ? (
            <div className="empty-state"><p>이 달의 시상 기록이 없습니다.</p></div>
          ) : (
            <div className="blocked-users-list">
              {awards.map(a => (
                <div key={a.id} className="blocked-user-item">
                  <div className="blocked-user-info">
                    <div>
                      <div className="blocked-user-name">{a.display_name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {a.tags.length === 0 ? (
                          <span className="blocked-user-date">키워드 없음</span>
                        ) : (
                          a.tags.map(t => (
                            <span key={t} className="challenge-category-chip active" style={{ fontSize: 12 }}>{t}</span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <button className="unblock-btn" onClick={() => handleDelete(a)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!adding ? (
            <button
              className="primary-button"
              style={{ marginTop: 16 }}
              onClick={() => setAdding(true)}
              disabled={candidates.length === 0}
            >
              <Plus size={16} /> 수상자 추가{candidates.length === 0 ? ' (후보 없음)' : ''}
            </button>
          ) : (
            <div className="settings-section" style={{ marginTop: 16, padding: 16 }}>
              <div className="race-form-group">
                <label>수상자</label>
                {/* 이름을 직접 입력받지 않고 그 달 랭킹에서 고르게 한다 —
                    오타·동명이인으로 엉뚱한 사람이 기록되는 걸 막는다 */}
                <select
                  className="race-form-input"
                  value={pickedUserId}
                  onChange={e => setPickedUserId(e.target.value)}
                >
                  <option value="">선택하세요</option>
                  {candidates.map(c => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.rank}위 · {c.display_name} ({c.total_mileage.toFixed(1)}점)
                    </option>
                  ))}
                </select>
              </div>

              <div className="race-form-group">
                <label>키워드</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="race-form-input"
                    placeholder="예: 1등, MVP, 개근"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                  />
                  <button className="challenge-scope-btn" onClick={() => addTag(tagInput)}>추가</button>
                </div>

                {tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {tags.map(t => (
                      <button
                        key={t}
                        className="challenge-category-chip active"
                        onClick={() => setTags(prev => prev.filter(x => x !== t))}
                      >
                        {t} <X size={12} />
                      </button>
                    ))}
                  </div>
                )}

                {usedTags.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="blocked-user-date" style={{ marginBottom: 6 }}>이전에 쓴 키워드</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {usedTags.filter(t => !tags.includes(t)).map(t => (
                        <button key={t} className="challenge-category-chip" onClick={() => addTag(t)}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="primary-button" onClick={handleSave} disabled={!pickedUserId || saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button className="challenge-scope-btn" onClick={resetForm} disabled={saving}>취소</button>
              </div>
            </div>
          )}
        </>
      )}
      {ConfirmDialog}
    </div>
  );
};
