import { useEffect, useRef } from 'react';

let uidCounter = 0;

// 모달이 열려있는 동안 배경 페이지 스크롤을 잠근다(모달 뒤 배경이 같이 스크롤되지
// 않게 하는 일반적인 처리). overflow:hidden으로 잠그면 간단하지만 html/body에
// overflow:hidden을 걸면 Android WebView에서 position:fixed 오버레이의 containing
// block이 document로 바뀌는 별개의 버그가 있어(CLAUDE.md) 여기선 못 쓴다. 대신
// body를 position:fixed로 현재 스크롤 위치에 고정하는 방식(overflow 미사용)을 쓴다.
// 중첩 모달(시트 안 시트)에서 여러 개가 동시에 열릴 수 있으므로 참조 카운트로 관리 —
// 맨 처음 잠글 때만 scrollY를 저장하고, 마지막 하나가 닫힐 때만 푼다.
//
// 참고: "시트 헤더 위로 본문이 비쳐 보이던" 버그는 이것과 무관했고, sticky 헤더가
// 시트의 padding-top 아래에 멈춰서 생긴 문제였다 → App.css 의 .race-modal-header 참고.
let scrollLockCount = 0;
let savedScrollY = 0;

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  scrollLockCount++;
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollY);
  }
}

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
  // StrictMode의 mount→cleanup→재mount 사이에도 같은 히스토리 엔트리를 재사용하기
  // 위한 상태. 이 ref들은 effect cleanup을 가로질러 유지된다(컴포넌트 인스턴스 자체는
  // 안 사라지고 effect만 두 번 실행되는 것뿐이라서).
  const idRef = useRef<number | null>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const myRunId = ++runIdRef.current;

    // 재mount마다 새로 push하면 StrictMode에서 모달 하나당 엔트리가 2개씩 쌓인다.
    // 단일 모달이면 무해하지만(닫을 때 1개만 pop해도 이후 첫 popstate 리스너가
    // 이미 해제돼 있어 티가 안 남), 모달 안에 모달을 중첩하면(예: 행사등록
    // 시트 안의 날짜피커) 안쪽 모달이 history.back()을 한 번 불러도 바깥 모달의
    // 엔트리가 아니라 이 여분 엔트리에 걸려서, 바깥 모달의 popstate 리스너가
    // id 불일치로 오판해 잘못 닫혀버리는 문제가 있었다. pushedRef로 실제 push는
    // 논리적 mount당 한 번만 일어나게 강제한다.
    if (!pushedRef.current) {
      idRef.current = ++uidCounter;
      history.pushState({ cardioModal: idRef.current }, '');
      pushedRef.current = true;
      lockBodyScroll();
    }
    const id = idRef.current;

    let closedByPop = false;
    const onPopState = (e: PopStateEvent) => {
      if (!e.state || e.state.cardioModal !== id) {
        closedByPop = true;
        pushedRef.current = false;
        unlockBodyScroll();
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      queueMicrotask(() => {
        if (runIdRef.current !== myRunId) return; // StrictMode 재mount — 정리 생략
        if (!closedByPop) {
          if (history.state?.cardioModal === id) {
            history.back();
          }
          pushedRef.current = false;
          unlockBodyScroll();
        }
      });
    };
  }, [isOpen]);
}
