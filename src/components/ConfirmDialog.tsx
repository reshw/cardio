import { createPortal } from 'react-dom';
import { useModalHistory } from '../hooks/useModalHistory';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// 네이티브 window.confirm()은 Android/iOS WebView에서 다이얼로그 자체가 뜨지
// 않고 조용히 취소 처리되는 경우가 있어(버튼 CSS 반응만 있고 아무 일도 안 일어남),
// 확인이 필요한 액션은 이 컴포넌트로 대체한다.
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: Props) => {
  useModalHistory(open, onCancel);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title || '확인'}</h2>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-description">{message}</p>
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={danger ? 'delete-button-danger' : 'primary-button'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
