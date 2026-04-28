import { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import raceService, { type RaceCategory, type RaceRecord, type CreateRaceData } from '../services/raceService';
import { uploadToR2 } from '../utils/r2Storage';

interface Props {
  userId: string;
  record?: RaceRecord;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORIES: RaceCategory[] = ['5K', '10K', '하프', '풀', '기타'];

function formatFinishTime(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  let h: string, m: string, s: string;
  if (digits.length <= 4) {
    const p = digits.padStart(4, '0');
    h = '0'; m = p.slice(0, 2); s = p.slice(2, 4);
  } else if (digits.length === 5) {
    h = digits[0]; m = digits.slice(1, 3); s = digits.slice(3, 5);
  } else {
    const p = digits.slice(-6).padStart(6, '0');
    h = String(parseInt(p.slice(0, 2), 10)); m = p.slice(2, 4); s = p.slice(4, 6);
  }
  return `${h}:${m}:${s}`;
}

export const AddRaceModal = ({ userId, record, onClose, onSaved }: Props) => {
  const [raceName, setRaceName] = useState(record?.race_name ?? '');
  const [raceDate, setRaceDate] = useState(record?.race_date ?? new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<RaceCategory>(record?.category ?? '풀');
  const [finishTime, setFinishTime] = useState(record?.finish_time ?? '');
  const [linkUrl, setLinkUrl] = useState(record?.link_url ?? '');
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(record?.image_url ?? '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!raceName.trim() || !finishTime.trim()) {
      alert('대회명과 기록은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      let imageUrl = record?.image_url;
      if (imageFile) imageUrl = await uploadToR2(imageFile);

      const data: CreateRaceData = {
        user_id: userId,
        race_name: raceName.trim(),
        race_date: raceDate,
        category,
        finish_time: formatFinishTime(finishTime.trim()),
        ...(imageUrl && { image_url: imageUrl }),
        ...(linkUrl.trim() && { link_url: linkUrl.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
      };

      if (record) {
        await raceService.updateRecord(record.id, data);
      } else {
        await raceService.createRecord(data);
      }
      onSaved();
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string };
      console.error('[RaceModal] save error:', e);
      alert(`저장 실패\ncode: ${e?.code ?? '-'}\nmessage: ${e?.message ?? '-'}\nhint: ${e?.hint ?? '-'}\ndetails: ${e?.details ?? '-'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-sheet race-modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="feedback-sheet-handle" />

        <div className="race-modal-header">
          <h3>{record ? '기록 수정' : '대회 기록 추가'}</h3>
          <button className="race-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="race-form">
          <div className="race-form-group">
            <label>대회명</label>
            <input
              value={raceName}
              onChange={e => setRaceName(e.target.value)}
              placeholder="서울마라톤 2025"
              className="race-input"
            />
          </div>

          <div className="race-form-row">
            <div className="race-form-group">
              <label>날짜</label>
              <input
                type="date"
                value={raceDate}
                onChange={e => setRaceDate(e.target.value)}
                className="race-input"
              />
            </div>
            <div className="race-form-group">
              <label>종목</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as RaceCategory)}
                className="race-input"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="race-form-group">
            <label>기록 <span className="race-label-hint">H:MM:SS 또는 MM:SS</span></label>
            <input
              value={finishTime}
              onChange={e => setFinishTime(e.target.value)}
              onBlur={() => setFinishTime(v => formatFinishTime(v))}
              placeholder="34215 또는 3:42:15"
              className="race-input race-time-input"
            />
          </div>

          <div className="race-form-group">
            <label>인증 이미지 <span className="race-label-hint">선택</span></label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            {imagePreview ? (
              <div className="race-img-preview" onClick={() => fileRef.current?.click()}>
                <img src={imagePreview} alt="미리보기" />
                <span className="race-img-change">변경</span>
              </div>
            ) : (
              <button className="race-img-placeholder" onClick={() => fileRef.current?.click()}>
                <Camera size={18} />
                <span>사진 추가</span>
              </button>
            )}
          </div>

          <div className="race-form-group">
            <label>기록 링크 <span className="race-label-hint">선택</span></label>
            <input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="race-input"
            />
          </div>

          <div className="race-form-group">
            <label>메모 <span className="race-label-hint">선택</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="날씨, 컨디션, 소감..."
              className="race-textarea"
              rows={3}
            />
          </div>
        </div>

        <button className="race-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : record ? '수정 완료' : '기록 저장'}
        </button>
      </div>
    </div>
  );
};
