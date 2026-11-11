import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { uploadToR2 } from '../utils/r2Storage';
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };
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
    if (!selected || !kmValid || !endName.trim() || !photoFile) return;
    setSaving(true);
    setError('');
    try {
      let photoUrl: string;
      try {
        photoUrl = await uploadToR2(photoFile);
      } catch (err: any) {
        console.error('[이어달리기] 멈춘 곳 사진 업로드 실패:', JSON.stringify(err), err);
        throw new Error(`사진 업로드 실패 — ${err?.message || JSON.stringify(err)}`);
      }
      await relayService.completeLeg(relayId, km, endName.trim(), photoUrl, selected, note.trim());
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
        <div className="relay-field">
          <span>멈춘 곳 사진 <em className="relay-required">필수</em> — 표지판·다리·인증센터처럼 알아볼 수 있게</span>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
          {photoPreview ? (
            <button type="button" className="relay-photo-preview" onClick={() => fileRef.current?.click()}>
              <img src={photoPreview} alt="멈춘 곳 사진 미리보기" />
              <span>바꾸기</span>
            </button>
          ) : (
            <button type="button" className="relay-photo-pick" onClick={() => fileRef.current?.click()}>
              <Camera size={18} /> 사진 올리기
            </button>
          )}
        </div>

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
          disabled={!selected || !kmValid || !endName.trim() || !photoFile || saving}
          onClick={submit}
        >
          {saving ? '사진 올리고 저장하는 중…' : !photoFile ? '멈춘 곳 사진을 올려 주세요' : '여기서 바통 넘기기'}
        </button>
      </div>
    </div>,
    document.body
  );
};
