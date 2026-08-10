import { useEffect, useRef } from 'react';

let uidCounter = 0;

// 모달이 열려있는 동안 히스토리 엔트리 하나를 유지해, 네이티브(Android) 뒤로가기가
// popstate로 들어오면 탭 전환 대신 모달을 닫는다. X버튼/배경클릭 등 다른 방식으로
// 닫힐 때는 자신이 push한 엔트리인 경우에만 history.back()으로 즉시 정리해
// 팬텀 엔트리(뒤로가기를 한 번 더 눌러야 실제로 이동하는 문제)를 막는다.
//
// 개발 모드 StrictMode는 mount 시 effect를 mount→cleanup→재mount 순으로 두 번
// 실행하는데, cleanup에서 곧바로 history.back()을 부르면 그 back()이 비동기로
// 처리되는 사이 재mount가 새 엔트리를 push해버려 방금 연 모달이 엉뚱한 popstate를
// 맞고 즉시 닫히는 문제가 있었다. cleanup의 정리 여부 판단을 마이크로태스크로
// 한 틱 미뤄, 그사이 같은 컴포넌트가 곧바로 재mount했으면(StrictMode) 아무 것도
// 하지 않고 넘어간다.
export function useModalHistory(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    const myRunId = ++runIdRef.current;
    const id = ++uidCounter;
    history.pushState({ cardioModal: id }, '');

    let closedByPop = false;
    const onPopState = (e: PopStateEvent) => {
      if (!e.state || e.state.cardioModal !== id) {
        closedByPop = true;
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      queueMicrotask(() => {
        if (runIdRef.current !== myRunId) return; // StrictMode 재mount — 정리 생략
        if (!closedByPop && history.state?.cardioModal === id) {
          history.back();
        }
      });
    };
  }, [isOpen]);
}
