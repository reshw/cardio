import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
