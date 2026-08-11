import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import clubEventService, { type ClubEvent } from '../services/clubEventService';

interface Props {
  event: ClubEvent;
  adminId: string;
  onClose: () => void;
  onReviewed: () => void;
}

// 전원 체크된 상태로 열고, 뺄 사람만 해제하는 방식.
// docs/plans/클럽달력.md 2절 — "체크인 안 한 사람 = 포인트 원치 않는 사람" 원칙과 짝을 이루는
// 반대쪽 규칙: 체크인은 했지만 실제로 안 왔다고 판단되면 여기서 운영진이 빼면 된다.
export const CheckinApprovalSheet = ({ event, adminId, onClose, onReviewed }: Props) => {
  useModalHistory(true, onClose);

  const [checked, setChecked] = useState<Set<string>>(
    new Set(event.checkins.map((c) => c.user_id))
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggle = (userId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await clubEventService.reviewCheckins({
        eventId: event.id,
        approvedUserIds: Array.from(checked),
        adminId,
      });
      onReviewed();
    } catch (err: any) {
      console.error('[클럽달력] 체크인 승인 처리 실패:', JSON.stringify(err), err);
      setErrorMsg(err?.message || err?.error_description || err?.hint || JSON.stringify(err));
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet checkin-approval-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">참가자 확인 · {event.title}</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <p className="checkin-approval-hint">
          체크인한 사람이 전체 선택된 상태입니다. 실제로 오지 않은 사람만 체크 해제하고 확인을 눌러주세요.
        </p>

        {event.checkins.length === 0 ? (
          <p className="empty-message">아직 체크인한 사람이 없습니다.</p>
        ) : (
          <div className="checkin-approval-list">
            {event.checkins.map((c) => (
              <label key={c.id} className="checkin-approval-item">
                <input
                  type="checkbox"
                  checked={checked.has(c.user_id)}
                  onChange={() => toggle(c.user_id)}
                />
                {c.profile_image ? (
                  <img src={c.profile_image} alt={c.nickname} className="participant-avatar" />
                ) : (
                  <div className="participant-avatar participant-avatar--fallback">{c.nickname[0]}</div>
                )}
                <span className="checkin-approval-name">{c.nickname}</span>
                {c.status === 'approved' && <span className="checkin-approval-status">이전 승인</span>}
              </label>
            ))}
          </div>
        )}

        {errorMsg && <p className="create-event-error">{errorMsg}</p>}

        <button
          type="button"
          className="challenge-create-submit"
          disabled={submitting || event.checkins.length === 0}
          onClick={handleConfirm}
        >
          {submitting ? '처리 중...' : `확인 (${checked.size}명 승인)`}
        </button>
      </div>
    </div>,
    document.body
  );
};
