import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import relayService from '../services/relayService';
import type { MyRunCandidate } from '../services/relayService';
import { describeKm } from '../data/relayCourses';
import type { RelayCourse } from '../data/relayCourses';

interface Props {
  relayId: string;
  course: RelayCourse;
  totalKm: number;
  doneKm: number;
  startName: string; // 앞사람이 멈춘 곳
  userId: string;
  usedWorkoutIds: string[];
  onClose: () => void;
  onDone: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const RelayCompleteSheet = ({ relayId, course, totalKm, doneKm, startName, userId, usedWorkoutIds, onClose, onDone }: Props) => {
  const navigate = useNavigate();
  useModalHistory(true, onClose);
  const [runs, setRuns] = useState<MyRunCandidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [kmText, setKmText] = useState('');
  const [endName, setEndName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const pick = (r: MyRunCandidate) => {
    setSelected(r.id);
    if (r.unit === 'km') setKmText(String(Math.round(Number(r.value) * 100) / 100));
  };

  useEffect(() => {
    relayService
      .getMyRecentRuns(userId, usedWorkoutIds)
      .then((r) => {
        setRuns(r);
        if (r.length > 0) pick(r[0]);
      })
      .catch((err: any) => setError(`내 달리기 기록을 못 불러왔어요: ${err?.message || JSON.stringify(err)}`));
  }, [userId]);

  const km = Number(kmText);
  const kmValid = kmText !== '' && km > 0 && km <= 300;
  const after = Math.min(totalKm, doneKm + (kmValid ? km : 0));
  const finishing = kmValid && doneKm + km >= totalKm;

  const submit = async () => {
    if (!selected || !kmValid || !endName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await relayService.completeLeg(relayId, km, endName.trim(), selected, note.trim());
      onDone();
    } catch (err: any) {
      setError(`인증 실패: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet relay-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">이어 달렸어요</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="relay-sheet-leg">
          <span>출발</span>
          <strong>{startName}</strong>
        </div>

        <div className="relay-sheet-label">달린 기록</div>
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
                <input type="radio" name="relay-run" checked={selected === r.id} onChange={() => pick(r)} />
                <span className="relay-run-km">{Number(r.value)}{r.unit}</span>
                <span className="relay-run-meta">{r.sub_type || '달리기'} · {fmtDate(r.workout_time)}</span>
              </label>
            ))}
          </div>
        )}

        <label className="relay-field">
          <span>이어 달린 거리 (km)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0.1}
            max={300}
            step={0.1}
            value={kmText}
            onChange={(e) => setKmText(e.target.value)}
          />
        </label>

        <label className="relay-field">
          <span>멈춘 곳 — 다음 사람이 여기서 출발해요</span>
          <input
            type="text"
            maxLength={60}
            placeholder="예: 팔당역 2번 출구, 양평 물소리길 입구"
            value={endName}
            onChange={(e) => setEndName(e.target.value)}
          />
        </label>
        {kmValid && (
          <div className="relay-sheet-hint">
            {finishing
              ? `🏁 이 기록으로 ${course.finishName}에 도착해요!`
              : `기준선으로는 ${describeKm(course, after, totalKm)} · 부산까지 ${Math.round(totalKm - after)}km 남아요`}
          </div>
        )}

        <textarea
          className="relay-note"
          placeholder="한 줄 소감 (선택)"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && <div className="relay-error">{error}</div>}

        <button
          type="button"
          className="relay-primary-btn"
          disabled={!selected || !kmValid || !endName.trim() || saving}
          onClick={submit}
        >
          {saving ? '저장하는 중…' : '여기서 바통 넘기기'}
        </button>
      </div>
    </div>,
    document.body
  );
};
