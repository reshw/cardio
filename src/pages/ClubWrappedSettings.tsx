import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Calendar as CalendarIcon, Check } from 'lucide-react';
import { useClubName } from '../hooks/useClubName';
import { useAuth } from '../contexts/AuthContext';
import clubService from '../services/clubService';
import CalendarPickerSheet from '../components/CalendarPickerSheet';
import { CardioWrapped } from '../components/CardioWrapped';
import {
  type WrappedPeriod, type WrappedWindow,
  defaultWindow, resolveWindow, isWithin, wrappedYearFor, toYmd,
} from '../utils/wrappedPeriod';

// 카디오 랩드 노출 기간 설정 (운영진 전용) — 규칙은 utils/wrappedPeriod.ts

type Mode = 'default' | 'custom' | 'off';

const parseYmd = (s: string) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const label = (s: string) => `${+s.slice(0, 4)}년 ${+s.slice(5, 7)}월 ${+s.slice(8, 10)}일`;
const shortLabel = (s: string) => `${+s.slice(5, 7)}월 ${+s.slice(8, 10)}일`;

function statusText(w: WrappedWindow | null) {
  if (!w) return '클럽 화면에 랩드 배너가 표시되지 않아요.';
  const today = toYmd(new Date());
  if (isWithin(w)) return `지금 표시 중 — ${w.year}년 결산, ${shortLabel(w.to)}까지`;
  if (today < w.from) return `${label(w.from)}부터 ${w.year}년 결산이 표시돼요.`;
  return `표시 기간이 끝났어요 (${label(w.to)}).`;
}

export const ClubWrappedSettings = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const clubName = useClubName(clubId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>('default');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [preview, setPreview] = useState(false);
  const [fullClubName, setFullClubName] = useState('');

  useEffect(() => {
    if (clubId) load();
  }, [clubId]);

  const load = async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const club = await clubService.getClubById(clubId);
      setFullClubName(club.name);
      const p = club.wrapped_period ?? null;
      const d = defaultWindow(new Date());
      if (!p) { setMode('default'); setFrom(d.from); setTo(d.to); }
      else if (p.mode === 'off') { setMode('off'); setFrom(d.from); setTo(d.to); }
      else { setMode('custom'); setFrom(p.from); setTo(p.to); }
    } catch (err: any) {
      console.error('[카디오랩드 설정] 클럽 조회 실패:', JSON.stringify(err), err);
      alert(`클럽 정보를 불러올 수 없습니다: ${err?.message || JSON.stringify(err)}`);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const currentPeriod = (): WrappedPeriod | null =>
    mode === 'default' ? null : mode === 'off' ? { mode: 'off' } : { mode: 'custom', from, to };

  const win = mode === 'custom' && (!from || !to || from > to) ? null : resolveWindow(currentPeriod());
  const previewYear = win?.year ?? defaultWindow(new Date()).year;

  const handleSave = async () => {
    if (!clubId) return;
    if (mode === 'custom') {
      if (!from || !to) { alert('시작일과 종료일을 모두 골라주세요.'); return; }
      if (from > to) { alert('시작일이 종료일보다 늦을 수 없어요.'); return; }
    }
    setSaving(true);
    try {
      await clubService.updateClub(clubId, { wrapped_period: currentPeriod() });
      alert('저장되었습니다.');
      navigate(-1);
    } catch (err: any) {
      console.error('[카디오랩드 설정] 저장 실패:', JSON.stringify(err), err);
      alert(`저장 실패: ${err?.message || err?.hint || JSON.stringify(err)}`);
    } finally {
      setSaving(false);
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

  const optionStyle = (on: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%', textAlign: 'left',
    padding: '14px 16px', marginBottom: '8px', borderRadius: '12px', cursor: 'pointer',
    background: 'var(--input-bg)', color: 'var(--text-primary)',
    border: `1.5px solid ${on ? 'var(--primary-color)' : 'var(--border-color)'}`,
  });
  const dot = (on: boolean) => (
    <span style={{
      flex: '0 0 20px', height: '20px', borderRadius: '50%', marginTop: '1px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: on ? 'var(--primary-color)' : 'transparent',
      border: on ? 'none' : '1.5px solid var(--border-color)', color: 'var(--on-accent)',
    }}>{on && <Check size={13} strokeWidth={3} />}</span>
  );
  const dateBtnStyle: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px',
    borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)',
    color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', minWidth: 0,
  };

  const options: { key: Mode; title: string; desc: string }[] = [
    { key: 'default', title: '기본', desc: '11월 1일 ~ 1월 31일 (11~12월은 올해, 1월은 작년 결산)' },
    { key: 'custom', title: '기간 직접 정하기', desc: '배너를 띄울 시작일과 종료일을 고릅니다' },
    { key: 'off', title: '표시 안 함', desc: '이 클럽에서는 랩드 배너를 띄우지 않습니다' },
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <div className="settings-header-title-group">
          {clubName && <span className="settings-header-club-name">{clubName}</span>}
          <h1>카디오 랩드</h1>
        </div>
      </div>

      <div className="settings-form">
        <div className="settings-section">
          <h3>표시 기간</h3>
          <p className="form-hint" style={{ marginBottom: '16px' }}>
            클럽 화면에 🎁 &lsquo;나의 카디오 랩드&rsquo; 배너가 보이는 기간이에요.<br />
            회원마다 자기 기록으로 한 해를 돌아봅니다.
          </p>

          {options.map((o) => (
            <div key={o.key}>
              <button type="button" style={optionStyle(mode === o.key)} onClick={() => setMode(o.key)}>
                {dot(mode === o.key)}
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600 }}>{o.title}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{o.desc}</span>
                </span>
              </button>

              {o.key === 'custom' && mode === 'custom' && (
                <div style={{ padding: '4px 4px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="button" style={dateBtnStyle} onClick={() => setPicking('from')}>
                      <CalendarIcon size={15} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{from ? label(from) : '시작일'}</span>
                    </button>
                    <span style={{ color: 'var(--text-secondary)' }}>~</span>
                    <button type="button" style={dateBtnStyle} onClick={() => setPicking('to')}>
                      <CalendarIcon size={15} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{to ? label(to) : '종료일'}</span>
                    </button>
                  </div>
                  {from && to && from > to ? (
                    <p style={{ fontSize: '13px', color: '#ef4444', marginTop: '8px' }}>시작일이 종료일보다 늦어요.</p>
                  ) : from ? (
                    <p className="form-hint" style={{ marginTop: '8px' }}>
                      {wrappedYearFor(from)}년 결산이 표시돼요. (시작일이 1~2월이면 작년 결산)
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.5 }}>
            {mode === 'custom' && (!from || !to || from > to) ? '기간을 골라주세요.' : statusText(win)}
          </p>
        </div>

        {user && !user.isGuest && clubId && (
          <button
            type="button"
            onClick={() => setPreview(true)}
            style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '12px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer' }}
          >
            🎁 내 {previewYear} 랩드 미리보기
          </button>
        )}

        <button
          type="button"
          className="primary-button-full"
          onClick={handleSave}
          disabled={saving}
          style={{ marginTop: '24px' }}
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      {picking && (
        <CalendarPickerSheet
          value={(picking === 'from' ? from : to) ? parseYmd(picking === 'from' ? from : to) : new Date()}
          onChange={(d) => (picking === 'from' ? setFrom : setTo)(toYmd(d))}
          onClose={() => setPicking(null)}
        />
      )}

      {preview && user && clubId && (
        <CardioWrapped
          clubId={clubId}
          clubName={fullClubName || clubName || ''}
          userId={user.id}
          fallbackName={user.display_name}
          year={previewYear}
          hideRank={false}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
};
