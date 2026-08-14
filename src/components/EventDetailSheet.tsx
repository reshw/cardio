import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { useModalHistory } from '../hooks/useModalHistory';
import { useConfirm } from '../hooks/useConfirm';
import clubEventService, { type ClubEvent, type EventPhoto, EVENT_TYPE_ICONS, EVENT_TYPE_LABELS } from '../services/clubEventService';
import { uploadToR2 } from '../utils/r2Storage';
import { CreateEventSheet } from './CreateEventSheet';
import { CheckinApprovalSheet } from './CheckinApprovalSheet';
import { PhotoLightbox } from './PhotoLightbox';

interface Props {
  eventId: string;
  userId: string;
  isManager: boolean;
  onClose: () => void;
  /** 체크인/승인/수정/삭제로 목록이 바뀌었을 때 부모(달력) 갱신용 */
  onChanged: () => void;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// 체크인 기능은 그대로 두되(로직/데이터는 유지) 아직 시기상조라 버튼+참가자 목록 UI만 숨김 (2026-08-11).
const SHOW_CHECKIN_UI = false;

// 시각은 메모(1. 일시)에 적으므로 여기선 달력 배치용 날짜만 표시한다.
function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAY_KO[d.getDay()]})`;
}

export const EventDetailSheet = ({ eventId, userId, isManager, onClose, onChanged }: Props) => {
  useModalHistory(true, onClose);
  const { confirm, ConfirmDialog } = useConfirm();

  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const loadPhotos = async (clubId: string) => {
    setPhotosLoading(true);
    try {
      setPhotos(await clubEventService.listEventPhotos(eventId, clubId));
    } catch (err: any) {
      console.error('[클럽달력] 행사 사진 조회 실패:', JSON.stringify(err), err);
    } finally {
      setPhotosLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await clubEventService.getEvent(eventId);
      setEvent(data);
      setErrorMsg(null);
      if (data) loadPhotos(data.club_id);
    } catch (err: any) {
      console.error('[클럽달력] 행사 상세 로드 실패:', JSON.stringify(err), err);
      setErrorMsg(err?.message || err?.error_description || err?.hint || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const mine = event?.checkins.find((c) => c.user_id === userId);

  const toggleCheckin = async () => {
    if (!event) return;
    setCheckinLoading(true);
    try {
      if (mine) {
        await clubEventService.cancelCheckIn(event.id, userId);
      } else {
        await clubEventService.checkIn(event.id, userId);
      }
      await load();
      onChanged();
    } catch (err: any) {
      console.error('[클럽달력] 체크인 토글 실패:', JSON.stringify(err), err);
      alert(`체크인 처리 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!(await confirm(`"${event.title}" 행사를 삭제할까요? 체크인 기록도 함께 삭제됩니다.`, { danger: true, confirmLabel: '삭제' }))) return;
    setDeleting(true);
    try {
      await clubEventService.deleteEvent(event.id);
      onChanged();
      onClose();
    } catch (err: any) {
      console.error('[클럽달력] 행사 삭제 실패:', JSON.stringify(err), err);
      alert(`삭제 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
      setDeleting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // e.target.value 를 리셋하면 브라우저에 따라 e.target.files(라이브 FileList)가
    // 같이 비워질 수 있다 — 반드시 배열로 먼저 떼어낸 뒤에 value를 지운다.
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0 || !event) return;

    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      for (const file of files) {
        const url = await uploadToR2(file, 'event');
        await clubEventService.addEventPhoto(event.id, userId, url);
      }
      await loadPhotos(event.club_id);
    } catch (err: any) {
      console.error('[클럽달력] 행사 사진 업로드 실패:', JSON.stringify(err), err);
      setPhotoError(err?.message || err?.error_description || err?.hint || JSON.stringify(err));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photo: EventPhoto): Promise<boolean> => {
    if (!(await confirm('이 사진을 삭제할까요?', { danger: true, confirmLabel: '삭제' }))) return false;
    try {
      await clubEventService.deleteEventPhoto(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      return true;
    } catch (err: any) {
      console.error('[클럽달력] 행사 사진 삭제 실패:', JSON.stringify(err), err);
      alert(`삭제 실패: ${err?.message || err?.error_description || err?.hint || JSON.stringify(err)}`);
      return false;
    }
  };

  const handleDeletePhotoFromLightbox = async (lightboxPhoto: { id?: string }) => {
    const target = photos.find((p) => p.id === lightboxPhoto.id);
    if (!target) return;
    const deleted = await handleDeletePhoto(target);
    if (!deleted) return;
    const remaining = photos.length - 1;
    setLightboxIndex((prev) => {
      if (prev === null) return null;
      if (remaining <= 0) return null;
      return Math.min(prev, remaining - 1);
    });
  };

  const approvedCheckins = event?.checkins.filter((c) => c.status !== 'rejected') ?? [];

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet event-detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">행사 상세</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="loading-screen"><div className="spinner"></div></div>
        ) : errorMsg ? (
          <div className="empty-state">
            <p>불러오지 못했습니다.</p>
            <p className="club-calendar-error-detail">{errorMsg}</p>
          </div>
        ) : !event ? (
          <div className="empty-state"><p>삭제된 행사입니다.</p></div>
        ) : (
          <>
            <div className="event-detail-head">
              <span className="event-detail-icon">{EVENT_TYPE_ICONS[event.event_type]}</span>
              <div>
                <div className="event-detail-title">{event.title}</div>
                <div className="event-detail-type">{event.category_text || EVENT_TYPE_LABELS[event.event_type]}</div>
              </div>
            </div>

            <div className="event-detail-meta-list">
              <div className="event-detail-meta-row">🕐 {formatEventDate(event.starts_at)}</div>
              {event.gpx_url && (
                <div className="event-detail-meta-row">
                  🧭 <a href={event.gpx_url} target="_blank" rel="noreferrer">GPX 보기</a>
                </div>
              )}
            </div>

            {event.description && (
              <p className="event-detail-description">{event.description}</p>
            )}

            {SHOW_CHECKIN_UI && (
              <button
                type="button"
                className={`checkin-toggle-btn checkin-toggle-btn--full ${mine ? 'checked' : ''}`}
                disabled={checkinLoading}
                onClick={toggleCheckin}
              >
                {mine ? '✓ 체크인 완료 (취소하려면 탭)' : '참가 체크인'}
              </button>
            )}

            {SHOW_CHECKIN_UI && (
              <div className="event-detail-participants">
                <h4>참가자 {approvedCheckins.length}명</h4>
                {approvedCheckins.length === 0 ? (
                  <p className="empty-message">아직 체크인한 사람이 없습니다.</p>
                ) : (
                  <div className="participant-avatar-list">
                    {approvedCheckins.map((c) => (
                      <div key={c.id} className="participant-chip">
                        {c.profile_image ? (
                          <img src={c.profile_image} alt={c.nickname} className="participant-avatar" />
                        ) : (
                          <div className="participant-avatar participant-avatar--fallback">{c.nickname[0]}</div>
                        )}
                        <span className="participant-name">{c.nickname}</span>
                        {c.status === 'approved' && <span className="participant-approved-badge" title={`승인: ${c.reviewer_nickname ?? ''}`}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="event-detail-participants">
              <h4>행사 사진{photos.length > 0 && ` ${photos.length}장`}</h4>

              <label htmlFor="event-photo-input" className="event-photo-upload-btn">
                {uploadingPhoto ? '업로드 중...' : '📷 사진 추가'}
              </label>
              <input
                id="event-photo-input"
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingPhoto}
                onChange={handlePhotoUpload}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />

              {photoError && <p className="create-event-error">{photoError}</p>}

              {photosLoading ? (
                <p className="empty-message">불러오는 중...</p>
              ) : photos.length === 0 ? (
                <p className="empty-message">아직 등록된 사진이 없습니다.</p>
              ) : (
                <div className="event-photo-grid">
                  {photos.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      className="event-photo-card"
                      onClick={() => setLightboxIndex(i)}
                    >
                      <img src={p.photo_url} alt={p.nickname} loading="lazy" />
                      <span className="event-photo-nick">{p.nickname}</span>
                      {(p.user_id === userId || isManager) && (
                        <span
                          role="button"
                          className="event-photo-delete-btn"
                          onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p); }}
                        ><Trash2 size={14} /></span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isManager && (
              <div className="event-detail-manager-actions">
                {SHOW_CHECKIN_UI && (
                  <button type="button" className="event-detail-action-btn" onClick={() => setShowApproval(true)}>
                    참가자 확인/승인
                  </button>
                )}
                <button type="button" className="event-detail-action-btn" onClick={() => setShowEdit(true)}>
                  수정
                </button>
                <button type="button" className="event-detail-action-btn event-detail-action-btn--danger" disabled={deleting} onClick={handleDelete}>
                  삭제
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showEdit && event && (
        <CreateEventSheet
          clubId={event.club_id}
          userId={userId}
          existingEvent={event}
          onClose={() => setShowEdit(false)}
          onCreated={() => {
            setShowEdit(false);
            load();
            onChanged();
          }}
        />
      )}

      {showApproval && event && (
        <CheckinApprovalSheet
          event={event}
          adminId={userId}
          onClose={() => setShowApproval(false)}
          onReviewed={() => {
            setShowApproval(false);
            load();
            onChanged();
          }}
        />
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos.map((p) => ({
            id: p.id,
            url: p.photo_url,
            caption: p.nickname,
            canDelete: p.user_id === userId || isManager,
          }))}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={handleDeletePhotoFromLightbox}
        />
      )}

      {ConfirmDialog}
    </div>,
    document.body
  );
};
