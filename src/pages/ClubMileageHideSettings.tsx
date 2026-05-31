import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import clubService from '../services/clubService';

export const ClubMileageHideSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [hideFromDay, setHideFromDay] = useState<string>('');
  const [hideToDay, setHideToDay] = useState<string>('');
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
      setHideFromDay(club.mileage_hide_from_day != null ? String(club.mileage_hide_from_day) : '');
      setHideToDay(club.mileage_hide_to_day != null ? String(club.mileage_hide_to_day) : '');
    } catch {
      alert('클럽 정보를 불러올 수 없습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clubId) return;

    const from = hideFromDay ? parseInt(hideFromDay) : null;
    const to = hideToDay ? parseInt(hideToDay) : null;

    if ((from !== null) !== (to !== null)) {
      alert('시작일과 종료일을 모두 입력하거나, 모두 비워주세요.');
      return;
    }
    if (from !== null && to !== null && from > to) {
      alert('시작일이 종료일보다 클 수 없습니다.');
      return;
    }

    setUpdating(true);
    try {
      await clubService.updateClub(clubId, {
        mileage_hide_from_day: from,
        mileage_hide_to_day: to,
      });
      alert(from === null ? '숨김 설정이 해제되었습니다.' : `매월 ${from}일 ~ ${to}일 숨김으로 저장되었습니다.`);
      navigate(-1);
    } catch {
      alert('설정 저장에 실패했습니다. 다시 시도해주세요.');
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
        <h1>마일리지 탭 숨김 기간</h1>
      </div>

      <div className="settings-form">
        <div className="settings-section">
          <h3>숨김 기간 설정</h3>
          <p className="form-hint" style={{ marginBottom: '20px' }}>
            매월 특정 기간 동안 일반 회원에게 🏆 마일리지 탭을 숨깁니다.<br />
            관리자(방장·부방장)는 항상 탭을 볼 수 있습니다.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>매월</label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="시작일"
              value={hideFromDay}
              onChange={(e) => setHideFromDay(e.target.value)}
              style={{ width: '72px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', fontSize: '16px', textAlign: 'center' }}
            />
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>일 ~</label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="종료일"
              value={hideToDay}
              onChange={(e) => setHideToDay(e.target.value)}
              style={{ width: '72px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', fontSize: '16px', textAlign: 'center' }}
            />
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>일 동안 숨김</label>
          </div>

          {hideFromDay && hideToDay && (
            <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--primary-color)' }}>
              현재 설정: 매월 {hideFromDay}일 ~ {hideToDay}일 숨김
            </p>
          )}
          {!hideFromDay && !hideToDay && (
            <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              현재 설정 없음 (항상 표시)
            </p>
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

        {(hideFromDay || hideToDay) && (
          <button
            type="button"
            onClick={() => { setHideFromDay(''); setHideToDay(''); }}
            style={{ marginTop: '12px', width: '100%', padding: '12px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer' }}
          >
            숨김 해제
          </button>
        )}
      </div>
    </div>
  );
};
