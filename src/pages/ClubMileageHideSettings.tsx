import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClubName } from '../hooks/useClubName';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import clubService from '../services/clubService';

type Period = { from: number; to: number };

export const ClubMileageHideSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const navigate = useNavigate();

  const [periods, setPeriods] = useState<Period[]>([]);
  const [addFrom, setAddFrom] = useState('');
  const [addTo, setAddTo] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clubId) loadClub();
  }, [clubId]);

  const loadClub = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const club = await clubService.getClubById(clubId);
      setPeriods(club.mileage_hide_periods || []);
    } catch {
      alert('클럽 정보를 불러올 수 없습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPeriod = () => {
    const from = parseInt(addFrom);
    const to = parseInt(addTo);
    if (!addFrom || !addTo || isNaN(from) || isNaN(to)) {
      alert('시작일과 종료일을 모두 입력해주세요.');
      return;
    }
    if (from < 1 || from > 31 || to < 1 || to > 31) {
      alert('날짜는 1~31 사이로 입력해주세요.');
      return;
    }
    if (from > to) {
      alert('시작일이 종료일보다 클 수 없습니다.');
      return;
    }
    setPeriods([...periods, { from, to }]);
    setAddFrom('');
    setAddTo('');
    setShowAddRow(false);
  };

  const handleRemove = (index: number) => {
    setPeriods(periods.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!clubId) return;
    setUpdating(true);
    try {
      await clubService.updateClub(clubId, { mileage_hide_periods: periods });
      alert('저장되었습니다.');
      navigate(-1);
    } catch {
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUpdating(false);
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
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>마일리지 탭 숨김 기간</h1>
        </div>
      </div>

      <div className="settings-form">
        <div className="settings-section">
          <h3>숨김 기간 목록</h3>
          <p className="form-hint" style={{ marginBottom: '16px' }}>
            설정된 기간 동안 일반 회원에게 🏆 마일리지 탭이 숨겨집니다.<br />
            관리자(방장·부방장)는 항상 볼 수 있습니다.
          </p>

          {periods.length === 0 && !showAddRow && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', padding: '16px 0' }}>
              설정된 기간 없음 (항상 표시)
            </p>
          )}

          {periods.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', marginBottom: '8px', background: 'var(--input-bg)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '15px', fontWeight: '500' }}>
                매월 {p.from}일 ~ {p.to}일
              </span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {showAddRow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', marginBottom: '8px', background: 'var(--input-bg)', borderRadius: '10px', border: '1px solid var(--primary-color)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>매월</span>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="시작일"
                value={addFrom}
                onChange={(e) => setAddFrom(e.target.value)}
                style={{ width: '68px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '15px', textAlign: 'center' }}
                autoFocus
              />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>일 ~</span>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="종료일"
                value={addTo}
                onChange={(e) => setAddTo(e.target.value)}
                style={{ width: '68px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '15px', textAlign: 'center' }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>일</span>
              <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={handleAddPeriod}
                  style={{ padding: '7px 14px', borderRadius: '8px', background: 'var(--primary-color)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddRow(false); setAddFrom(''); setAddTo(''); }}
                  style={{ padding: '7px 14px', borderRadius: '8px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {!showAddRow && (
            <button
              type="button"
              onClick={() => setShowAddRow(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '10px 14px', borderRadius: '10px', background: 'none', border: '1px dashed var(--border-color)', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '14px', width: '100%', justifyContent: 'center' }}
            >
              <Plus size={16} />
              기간 추가
            </button>
          )}
        </div>

        <button
          type="button"
          className="primary-button-full"
          onClick={handleSave}
          disabled={updating}
          style={{ marginTop: '32px' }}
        >
          {updating ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
};
