import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import CalendarPickerSheet from './CalendarPickerSheet';
import clubEventService, { type ClubEvent, type ClubEventType, EVENT_TYPE_ICONS } from '../services/clubEventService';

const EVENT_TYPES: ClubEventType[] = ['trail', 'lsd', 'interval', 'swim', 'gathering', 'race', 'etc'];

interface Props {
  clubId: string;
  userId: string;
  existingEvent?: ClubEvent; // 있으면 수정 모드
  onClose: () => void;
  onCreated: () => void;
}

// 카톡방에 공지할 때 쓰던 번호 매긴 양식 그대로 — 메모엔 머릿말만 띄워주고
// 나머지는 클럽장이 직접 채워 넣는다 (일시/집결장소·짐보관/코스/장비/난이도).
const MEMO_TEMPLATE = `1. 일시: \n2. 집결장소 및 짐 보관: \n3. 코스: \n4. 장비: \n5. 난이도: `;

export const CreateEventSheet = ({ clubId, userId, existingEvent, onClose, onCreated }: Props) => {
  useModalHistory(true, onClose);

  const initial = existingEvent ? new Date(existingEvent.starts_at) : new Date();

  const [title, setTitle] = useState(existingEvent?.title ?? '');
  const [eventType, setEventType] = useState<ClubEventType>(existingEvent?.event_type ?? 'etc');
  const [categoryText, setCategoryText] = useState(existingEvent?.category_text ?? '');
  const [pickedDate, setPickedDate] = useState<Date>(new Date(initial.getFullYear(), initial.getMonth(), initial.getDate()));
  const [memo, setMemo] = useState(existingEvent?.description ?? MEMO_TEMPLATE);
  const [gpxMode, setGpxMode] = useState<'link' | 'file'>('link');
  const [gpxUrl, setGpxUrl] = useState(existingEvent?.gpx_url ?? '');
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxUploading, setGpxUploading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dateLabel = `${pickedDate.getFullYear()}년 ${pickedDate.getMonth() + 1}월 ${pickedDate.getDate()}일`;

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMsg('행사 제목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    // 시각은 메모(1. 일시)에 적으므로 달력 배치용 날짜만 사용 — 자정으로 고정.
    const startsAt = new Date(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate()).toISOString();

    try {
      let resolvedGpxUrl = gpxUrl.trim();
      if (gpxMode === 'file' && gpxFile) {
        setGpxUploading(true);
        try {
          resolvedGpxUrl = await clubEventService.uploadGpxFile(clubId, gpxFile);
        } finally {
          setGpxUploading(false);
        }
      }

      if (existingEvent) {
        await clubEventService.updateEvent(existingEvent.id, {
          title: title.trim(),
          eventType,
          categoryText: categoryText.trim(),
          startsAt,
          gpxUrl: resolvedGpxUrl,
          description: memo.trim(),
        });
      } else {
        await clubEventService.createEvent({
          clubId,
          createdBy: userId,
          title: title.trim(),
          eventType,
          categoryText: categoryText.trim() || undefined,
          startsAt,
          gpxUrl: resolvedGpxUrl || undefined,
          description: memo.trim() || undefined,
        });
      }
      onCreated();
    } catch (err: any) {
      console.error('[클럽달력] 행사 저장 실패:', JSON.stringify(err), err);
      setErrorMsg(err?.message || err?.error_description || err?.hint || JSON.stringify(err));
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet create-event-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">{existingEvent ? '행사 수정' : '행사 등록'}</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="create-event-form">
          <label className="create-event-label">
            행사명
            <input
              className="search-input"
              placeholder="예: 8/22 트레일러닝"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
            />
          </label>

          <div className="create-event-label">
            아이콘
            <div className="event-type-pill-row">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`event-type-pill event-type-pill--icon ${eventType === t ? 'active' : ''}`}
                  onClick={() => setEventType(t)}
                >
                  {EVENT_TYPE_ICONS[t]}
                </button>
              ))}
            </div>
          </div>

          <label className="create-event-label">
            종목
            <input
              className="search-input"
              placeholder="예: LSD, 인터벌 러닝 등"
              value={categoryText}
              onChange={(e) => setCategoryText(e.target.value)}
              maxLength={30}
            />
          </label>

          <label className="create-event-label">
            날짜 (달력 표시용)
            <button type="button" className="create-event-date-btn" onClick={() => setShowDatePicker(true)}>
              📅 {dateLabel}
            </button>
          </label>

          <label className="create-event-label">
            메모
            <textarea
              className="search-input"
              rows={7}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              style={{ resize: 'none' }}
            />
          </label>

          <div className="create-event-label">
            첨부 (GPX, 선택)
            <div className="event-type-pill-row">
              <button
                type="button"
                className={`event-type-pill ${gpxMode === 'link' ? 'active' : ''}`}
                onClick={() => setGpxMode('link')}
              >
                링크
              </button>
              <button
                type="button"
                className={`event-type-pill ${gpxMode === 'file' ? 'active' : ''}`}
                onClick={() => setGpxMode('file')}
              >
                파일 업로드
              </button>
            </div>
            {gpxMode === 'link' ? (
              <input
                className="search-input"
                placeholder="예: Strava/구글 드라이브 GPX 링크"
                value={gpxUrl}
                onChange={(e) => setGpxUrl(e.target.value)}
              />
            ) : (
              <>
                <label htmlFor="gpx-file-input" className="create-event-date-btn" style={{ display: 'block', cursor: 'pointer' }}>
                  📎 {gpxFile ? gpxFile.name : (gpxUrl ? 'GPX 파일 업로드됨 (다시 선택하려면 탭)' : 'GPX 파일 선택')}
                </label>
                <input
                  id="gpx-file-input"
                  type="file"
                  accept=".gpx"
                  onChange={(e) => setGpxFile(e.target.files?.[0] ?? null)}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                />
              </>
            )}
          </div>

          {errorMsg && <p className="create-event-error">{errorMsg}</p>}

          <button
            type="button"
            className="challenge-create-submit"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {gpxUploading ? 'GPX 업로드 중...' : submitting ? '저장 중...' : existingEvent ? '수정 완료' : '행사 등록'}
          </button>
        </div>
      </div>

      {showDatePicker && (
        <CalendarPickerSheet
          value={pickedDate}
          onChange={(d) => setPickedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </div>,
    document.body
  );
};
