import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from './useModalHistory';

interface PromptOptions {
  title?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptState extends PromptOptions {
  message: string;
}

// window.prompt() 도 confirm()과 같은 이유로 Android/iOS WebView에서 안 뜨는 경우가
// 있어 대체하는 훅. `const v = prompt('...'); if (!v) return;` 자리를
// `const v = await prompt('...'); if (!v) return;` 로 그대로 바꿔 쓸 수 있다.
export function usePrompt() {
  const [state, setState] = useState<PromptState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const resolveRef = useRef<((v: string | null) => void) | null>(null);

  const promptAsync = useCallback((message: string, options?: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve;
      setInputValue('');
      setState({ message, ...options });
    });
  }, []);

  const settle = (result: string | null) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  useModalHistory(state !== null, () => settle(null));

  const PromptDialog = state
    ? createPortal(
        <div className="modal-overlay" onClick={() => settle(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{state.title || '입력'}</h2>
              <button className="modal-close" onClick={() => settle(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">{state.message}</p>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', marginBottom: 12 }}
                autoFocus
                value={inputValue}
                placeholder={state.placeholder}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') settle(inputValue);
                }}
              />
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => settle(null)}>
                  {state.cancelLabel || '취소'}
                </button>
                <button type="button" className="primary-button" onClick={() => settle(inputValue)}>
                  {state.confirmLabel || '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return { prompt: promptAsync, PromptDialog };
}
