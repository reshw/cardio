import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import relayService from '../services/relayService';
import type { MyRunCandidate } from '../services/relayService';
import type { RelayLeg } from '../data/relayCourses';

interface Props {
  relayId: string;
  leg: RelayLeg;
  userId: string;
  usedWorkoutIds: string[];
  onClose: () => void;
  onDone: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const RelayCompleteSheet = ({ relayId, leg, userId, usedWorkoutIds, onClose, onDone }: Props) => {
  const navigate = useNavigate();
  useModalHistory(true, onClose);
  const [runs, setRuns] = useState<MyRunCandidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    relayService
      .getMyRecentRuns(userId, usedWorkoutIds)
      .then((r) => {
        setRuns(r);
        if (r.length > 0) setSelected(r[0].id);
      })
      .catch((err: any) => setError(`내 달리기 기록을 못 불러왔어요: ${err?.message || JSON.stringify(err)}`));
  }, [userId]);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await relayService.completeLeg(relayId, leg.no, selected, note.trim());
      onDone();
    } catch (err: any) {
      setError(`인증 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const picked = runs?.find((r) => r.id === selected);
  const short = picked && picked.unit === 'km' && picked.value < leg.km * 0.6;

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet relay-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">{leg.no + 1}구간 완주 인증</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="relay-sheet-leg">
          <strong>{leg.from.name} → {leg.to.name}</strong>
          <span>약 {leg.km}km</span>
        </div>

        <div className="relay-sheet-label">이 구간을 뛴 기록을 골라 주세요</div>
        {runs === null && !error && <div className="relay-sheet-empty">불러오는 중…</div>}
        {runs && runs.length === 0 && (
          <div className="relay-sheet-empty">
            최근 30일 달리기 기록이 없어요.
            <button type="button" className="relay-link-btn" onClick={() => navigate('/add-workout')}>
              운동 기록 먼저 올리기
            </button>
          </div>
        )}
        {runs && runs.length > 0 && (
          <div className="relay-run-list">
            {runs.map((r) => (
              <label key={r.id} className={`relay-run${selected === r.id ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="relay-run"
                  checked={selected === r.id}
                  onChange={() => setSelected(r.id)}
                />
                <span className="relay-run-km">{Number(r.value)}{r.unit}</span>
                <span className="relay-run-meta">{r.sub_type || '달리기'} · {fmtDate(r.workout_time)}</span>
              </label>
            ))}
          </div>
        )}
        {short && (
          <div className="relay-sheet-hint">구간 거리(약 {leg.km}km)보다 꽤 짧은 기록이에요. 맞는지 한 번 더 확인해 주세요.</div>
        )}

        <textarea
          className="relay-note"
          placeholder="한 줄 소감 (선택) — 예: 한강 바람 미쳤다"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <div className="relay-error">{error}</div>}

        <button type="button" className="relay-primary-btn" disabled={!selected || saving} onClick={submit}>
          {saving ? '인증하는 중…' : `바통 넘기기 → ${leg.to.name}`}
        </button>
      </div>
    </div>,
    document.body
  );
};
