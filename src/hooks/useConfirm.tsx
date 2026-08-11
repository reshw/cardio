import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from './useModalHistory';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  message: string;
}

// window.confirm()은 Android/iOS WebView에서 다이얼로그 자체가 뜨지 않고 조용히
// 취소 처리되는 경우가 있다 (버튼 CSS 반응만 있고 실제 처리는 안 됨). 기존
// `if (!confirm('...')) return;` 자리를 `if (!(await confirm('...'))) return;`로
// 그대로 바꿔 쓸 수 있도록 동일한 Promise<boolean> 형태로 만든 대체 훅.
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ message, ...options });
    });
  }, []);

  const settle = (result: boolean) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  useModalHistory(state !== null, () => settle(false));

  const ConfirmDialog = state
    ? createPortal(
        <div className="modal-overlay" onClick={() => settle(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{state.title || '확인'}</h2>
              <button className="modal-close" onClick={() => settle(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">{state.message}</p>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => settle(false)}>
                  {state.cancelLabel || '취소'}
                </button>
                <button
                  type="button"
                  className={state.danger ? 'delete-button-danger' : 'primary-button'}
                  onClick={() => settle(true)}
                >
                  {state.confirmLabel || '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return { confirm, ConfirmDialog };
}
