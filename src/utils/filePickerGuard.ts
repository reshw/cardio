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
  window.addEventListener('popstate', () => {
    if (active && savedHash) {
      // URL을 원래대로 복원 → React Router의 popstate 핸들러가 동일 URL을 보고 네비게이션 안 함
      history.pushState(null, '', window.location.pathname + window.location.search + savedHash);
    }
  });
}
