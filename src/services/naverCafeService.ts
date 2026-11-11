import { supabase } from '../lib/supabase';

// 네이버 카페 자동 발행 — 서버: api/naver-cafe.ts (토큰은 서버에만 있음)

export interface NaverCafeStatus {
  connected: boolean;
  cafeId?: string | null;
  menuId?: string | null;
  boardUrl?: string | null;
  autoPublish?: boolean;
  connectedAt?: string | null;
  connectedByName?: string | null;
}

export interface NaverCafePublishResult {
  published?: boolean;
  skipped?: boolean;
  reason?: 'already_published' | 'not_connected' | 'auto_publish_off' | 'no_board';
  articleUrl?: string;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('로그인 세션이 없습니다');

  const res = await fetch('/api/naver-cafe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* 아래서 원문 노출 */ }
  if (!res.ok) {
    const msg = json?.error || text.slice(0, 300) || `HTTP ${res.status}`;
    console.error(`[네이버카페] ${body.action} 실패 (${res.status}):`, msg);
    throw new Error(msg);
  }
  return json as T;
}

const naverCafeService = {
  getStatus: (clubId: string) => call<NaverCafeStatus>({ action: 'status', clubId }),

  async startConnect(clubId: string): Promise<void> {
    const { authorizeUrl } = await call<{ authorizeUrl: string }>({
      action: 'start', clubId, origin: window.location.origin,
    });
    window.location.href = authorizeUrl;
  },

  saveSettings: (clubId: string, params: { boardUrl?: string; autoPublish?: boolean }) =>
    call<NaverCafeStatus>({ action: 'settings', clubId, ...params }),

  disconnect: (clubId: string) => call<NaverCafeStatus>({ action: 'disconnect', clubId }),

  publishEvent: (eventId: string) => call<NaverCafePublishResult>({ action: 'publish', eventId }),
};

export default naverCafeService;
