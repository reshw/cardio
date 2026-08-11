import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 기존 HashRouter 시절 북마크/공유 링크 호환:
// `#/foo` 패턴이면 클린 URL로 마이그레이션 후 React가 라우팅하도록 둠.
// PKCE 코드가 hash에 묻혀온 경우도 search로 끌어올려 Supabase가 잡을 수 있게 한다.
{
  const hash = window.location.hash;
  if (hash.startsWith('#/')) {
    const [pathPart, queryPart = ''] = hash.slice(1).split('?');
    const existingSearch = window.location.search;
    const mergedSearch = queryPart
      ? (existingSearch ? `${existingSearch}&${queryPart}` : `?${queryPart}`)
      : existingSearch;
    const newUrl = window.location.origin + pathPart + mergedSearch;
    window.history.replaceState({}, '', newUrl);
  }
}

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
