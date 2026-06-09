let active = false;
let savedHash = '';

export function enableFilePickerGuard() {
  active = true;
  savedHash = window.location.hash || '#/';
}

export function disableFilePickerGuard() {
  active = false;
  savedHash = '';
}

export function isFilePickerGuardActive() {
  return active;
}

// main.tsx에서 createRoot() 전에 호출 — React Router보다 먼저 등록되어야 함
export function installFilePickerGuard() {
  window.addEventListener('popstate', (e) => {
    if (active && savedHash) {
      // stopImmediatePropagation: React Router의 popstate 핸들러 자체를 차단
      // pushState만으로는 URL이 복원되어도 React Router가 "navigation 발생"으로 인식해 re-mount
      e.stopImmediatePropagation();
      history.pushState(null, '', window.location.pathname + window.location.search + savedHash);
    }
  });
}
