import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installFilePickerGuard } from './utils/filePickerGuard'

// React Router보다 먼저 등록해야 popstate를 우선 처리 가능
installFilePickerGuard()

// Kakao SDK global type
declare global {
  interface Window {
    Kakao: any;
  }
}

// Initialize Kakao SDK
if (window.Kakao && !window.Kakao.isInitialized()) {
  const kakaoKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY;
  if (kakaoKey) {
    window.Kakao.init(kakaoKey);
    console.log('Kakao SDK initialized:', window.Kakao.isInitialized());
  } else {
    console.warn('VITE_KAKAO_JAVASCRIPT_KEY is not set');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
