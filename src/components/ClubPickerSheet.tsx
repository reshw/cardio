import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';

interface Props {
  title: string;
  options: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * 클럽/옵션 선택 바텀시트.
 * 네이티브 앱 WebView 에서 `<select>` 드롭다운 팝업이 안 뜨는 문제 때문에
 * 사용자 노출 select 를 이걸로 교체한다 (헤더·오버레이 클래스는 기존 시트 패턴 재사용).
 */
export const ClubPickerSheet = ({ title, options, selectedId, onSelect, onClose }: Props) => {
  useModalHistory(true, onClose);

  return createPortal(
    <div className="feedback-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="feedback-sheet member-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-handle" />
        <div className="race-modal-header">
          <div style={{ width: 32 }} />
          <span className="date-picker-title">{title}</span>
          <button className="race-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="member-picker-list">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="member-picker-item"
              onClick={() => { onSelect(o.id); onClose(); }}
              style={{ fontWeight: o.id === selectedId ? 700 : 400 }}
            >
              <div className="member-picker-item-text">
                <span className="member-picker-nickname">{o.name}</span>
              </div>
              {o.id === selectedId && <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--primary-color)' }}>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};
