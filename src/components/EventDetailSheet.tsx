import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';
import { EventDetailContent } from './EventDetailContent';

interface Props {
  eventId: string;
  userId: string;
  isManager: boolean;
  onClose: () => void;
  /** 체크인/승인/수정/삭제로 목록이 바뀌었을 때 부모(달력) 갱신용 */
  onChanged: () => void;
}

// 날짜 시트를 거치지 않고 행사 하나를 바로 여는 독립 시트 (오늘 카드·다가오는/지난 행사 목록).
// 본문은 EventDetailContent — 날짜 시트의 행사 탭과 같은 걸 쓴다.
export const EventDetailSheet = ({ eventId, userId, isManager, onClose, onChanged }: Props) => {
  useModalHistory(true, onClose);

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet event-detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">행사 상세</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <EventDetailContent
          eventId={eventId}
          userId={userId}
          isManager={isManager}
          onChanged={onChanged}
          onDeleted={onClose}
        />
      </div>
    </div>,
    document.body
  );
};
