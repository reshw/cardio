import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// 네이버 카페 자동 발행 — 함수 하나로 전부 처리 (Vercel Hobby 함수 12개 제한)
//   GET  ?code&state        네이버 OAuth 콜백 (/api/naver-cafe-callback 이 vercel.json rewrite 로 여기로 옴)
//   POST {action:'status'}      연동 상태 (토큰 제외)
//   POST {action:'start'}       네이버 로그인 URL 발급
//   POST {action:'settings'}    게시판 주소 / 자동발행 on-off 저장
//   POST {action:'disconnect'}  연동 해제
//   POST {action:'publish'}     행사 → 카페 글 발행
// 토큰은 club_naver_cafe(RLS ON, 정책 0개)에만 있고 service_role 로만 접근한다.

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'CzQO3X7n6JhXdgMJCGBK';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const ALLOWED_RETURN_HOSTS = ['cardio.scnd.kr', 'crd.scnd.kr', 'cardio-staging-test.vercel.app', 'localhost', '127.0.0.1'];
const STATE_TTL_MS = 10 * 60 * 1000;

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// 연동 안 된 클럽의 행사 등록(publish → skipped)까지 막지 않도록, 시크릿은 실제로 쓰는 시점에만 검사
function requireSecret(): string {
  if (!NAVER_CLIENT_SECRET) throw new HttpError(500, '서버 환경변수 NAVER_CLIENT_SECRET 이 없습니다 (이 배포 환경 스코프 확인)');
  return NAVER_CLIENT_SECRET;
}

// ---------- 인증 ----------

async function getAppUserId(req: VercelRequest): Promise<{ userId: string; token: string }> {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new HttpError(401, '로그인 토큰이 없습니다');
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, `로그인 확인 실패: ${error?.message || 'no user'}`);
  const { data: u, error: uErr } = await sb.from('users').select('id').eq('auth_id', data.user.id).maybeSingle();
  if (uErr || !u) throw new HttpError(401, `사용자 조회 실패: ${uErr?.message || '연결된 사용자 없음'}`);
  return { userId: u.id, token };
}

async function assertClubAdmin(clubId: string, userId: string) {
  const { data, error } = await admin()
    .from('club_members').select('role').eq('club_id', clubId).eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, `권한 조회 실패: ${error.message}`);
  if (!data || !['manager', 'vice-manager'].includes(data.role)) {
    throw new HttpError(403, '클럽장/부클럽장만 네이버 카페 연동을 설정할 수 있습니다');
  }
}

async function assertEventManager(clubId: string, token: string) {
  // RLS 와 같은 판정 함수 — 방장/부방장 + manage_events 커스텀 등급(파트장 등)
  const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.rpc('is_club_event_manager', { p_club_id: clubId });
  if (error) throw new HttpError(500, `행사 권한 조회 실패: ${error.message}`);
  if (data !== true) throw new HttpError(403, '행사 관리 권한이 없습니다');
}

// ---------- OAuth state (HMAC 서명) ----------

function signState(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', requireSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyState(state: string): { c: string; u: string; o: string; e: number } {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('state 형식 오류');
  const expected = crypto.createHmac('sha256', requireSecret()).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('state 서명 불일치');
  }
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (Date.now() > p.e) throw new Error('연동 시간이 만료됐습니다 (10분). 다시 시도해주세요');
  return p;
}

function safeOrigin(origin: string | undefined): string {
  try {
    const u = new URL(origin || '');
    if (ALLOWED_RETURN_HOSTS.includes(u.hostname)) return u.origin;
  } catch { /* fallthrough */ }
  return 'https://cardio.scnd.kr';
}

function callbackUrl(req: VercelRequest): string {
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'cardio.scnd.kr';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}/api/naver-cafe-callback`;
}

// ---------- 게시판 주소 파싱 ----------

function parseBoardUrl(raw: string): { cafeId: string; menuId: string } | null {
  let s = raw.trim();
  try { s = decodeURIComponent(decodeURIComponent(s)); } catch { /* 이미 디코딩됨 */ }
  // 새 화면: cafe.naver.com/f-e/cafes/31581338/menus/1 , ca-fe/cafes/.., m.cafe ca-fe/web/cafes/..
  let m = s.match(/cafes\/(\d+)\/menus\/(\d+)/);
  if (m) return { cafeId: m[1], menuId: m[2] };
  // 예전 화면: ArticleList.nhn?search.clubid=31581338&search.menuid=1
  const c = s.match(/clubid=(\d+)/i);
  const mm = s.match(/menuid=(\d+)/i);
  if (c && mm) return { cafeId: c[1], menuId: mm[1] };
  return null;
}

// ---------- 네이버 토큰 ----------

async function naverToken(params: Record<string, string>) {
  const qs = new URLSearchParams({ client_id: NAVER_CLIENT_ID, client_secret: requireSecret(), ...params });
  const r = await fetch(`https://nid.naver.com/oauth2.0/token?${qs}`, { method: 'POST' });
  const text = await r.text();
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error(`네이버 토큰 응답 파싱 실패 (${r.status}): ${text.slice(0, 300)}`); }
  if (!r.ok || j.error || !j.access_token) {
    throw new Error(`네이버 토큰 발급 실패 (${r.status}): ${j.error || ''} ${j.error_description || text.slice(0, 300)}`);
  }
  return j as { access_token: string; refresh_token?: string; expires_in: string | number };
}

async function getValidAccessToken(row: any, clubId: string): Promise<string> {
  const exp = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && exp - Date.now() > 60_000) return row.access_token;
  if (!row.refresh_token) throw new Error('네이버 연동 토큰이 없습니다. 클럽 설정에서 다시 연동해주세요');
  console.log('[naver-cafe] 액세스 토큰 갱신', clubId);
  const t = await naverToken({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
  const patch: Record<string, unknown> = {
    access_token: t.access_token,
    token_expires_at: new Date(Date.now() + Number(t.expires_in) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (t.refresh_token) patch.refresh_token = t.refresh_token;
  const { error } = await admin().from('club_naver_cafe').update(patch).eq('club_id', clubId);
  if (error) console.error('[naver-cafe] 갱신 토큰 저장 실패:', JSON.stringify(error));
  return t.access_token;
}

// ---------- 글 본문 ----------

// ⚠️ 카페 API 는 본문(제목 포함)에 큰따옴표(")가 하나라도 있으면 999 "오류가 발생하였습니다" 로 거부한다.
// 2026-11-12 orangelnilw 카페 실측:
//   성공 — 텍스트, 이모지, \n, <br>, <b>, <h3>, <font color=#..>, <a href=URL>,
//          <span style='color:..;background-color:..'> (속성은 따옴표 없이 또는 작은따옴표)
//   실제 행사 포맷도 테스트14 로 발행 확인 (배지+h3+색 라벨+링크).
//   실패 — <span style="...">, <a href="..."> (큰따옴표)
// 그래서 태그 속성엔 작은따옴표만 쓰고, 사용자 입력의 " 는 전각 ＂ 로 바꾼다. < > 도 무력화.
// 글씨체: font-family 는 지워지지 않지만 폰트 파일은 안 따라간다 → 보는 사람 PC에 있는 폰트로만 나옴.
// 없을 때 브라우저 기본 고딕(본고딕 계열)으로 깨지는 게 카페 기본(맑은 고딕)보다 나아서 본고딕 계열을 지정.
const FONT_STACK = 'Noto Sans KR,Noto Sans CJK KR,Source Han Sans KR,Pretendard,sans-serif';
const clean = (s: string) => s.replace(/"/g, '＂').replace(/</g, '＜').replace(/>/g, '＞');
const nl2br = (s: string) => clean(s).replace(/\r?\n/g, '<br>');
// href 값은 따옴표 없이 넣으므로 공백·따옴표·꺾쇠가 있으면 속성이 깨진다 → http(s) 만 허용 + 인코딩
const safeUrl = (u: string): string | null => {
  const s = String(u || '').trim();
  if (!/^https?:\/\//i.test(s)) return null;
  return s.replace(/[\s"'<>]/g, (c) => encodeURIComponent(c));
};

const ACCENT = '#1a73e8';   // 라벨·링크 (카페 기본 링크색 계열)
const MUTED = '#868e96';    // 하단 안내문
const label = (icon: string, text: string) => `${icon} <b><font color=${ACCENT}>${text}</font></b>`;
const badge = (text: string) => `<span style='background-color:#e8f0fe;color:${ACCENT};padding:1px 6px;border-radius:4px'><b>${text}</b></span>`;

function buildContent(ev: any): string {
  const d = new Date(ev.starts_at);
  const ymd = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });
  const wd = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' });
  const date = `${ymd} (${wd})`;
  // h3 는 블록이라 뒤에 <br> 을 붙이면 빈 줄이 생김 → 헤더는 따로 이어붙임
  const header = `${badge('클럽 행사')}<h3>${clean(ev.title || '')}</h3>`;
  const parts: string[] = [`${label('📅', '날짜')}  ${clean(date)}`];
  if (ev.category_text) parts.push(`${label('🏃', '종목')}  ${clean(ev.category_text)}`);
  if (ev.description) parts.push('', nl2br(ev.description));
  const gpx = ev.gpx_url ? safeUrl(ev.gpx_url) : null;
  if (gpx) parts.push('', `${label('🗺', '코스')}  <a href=${gpx}><font color=${ACCENT}>GPX 파일 받기</font></a>`);
  parts.push(
    '',
    `<font color=${MUTED}>카디오 클럽달력에 등록된 행사입니다. 참가 체크인은 카디오 앱에서 해주세요.</font>`,
    `👉 <a href=https://cardio.scnd.kr><b><font color=${ACCENT}>카디오에서 보기</font></b></a>`,
  );
  return `<span style='font-family:${FONT_STACK}'>${header}${parts.join('<br>')}</span>`;
}

async function postArticle(accessToken: string, cafeId: string, menuId: string, subject: string, content: string) {
  // 네이버 카페 API 는 subject/content 값을 URL 인코딩된 UTF-8 문자열로 받는다 (공식 예제 방식).
  const form = new FormData();
  form.append('subject', encodeURIComponent(subject));
  form.append('content', encodeURIComponent(content));
  const r = await fetch(`https://openapi.naver.com/v1/cafe/${cafeId}/menu/${menuId}/articles`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* 아래서 원문 노출 */ }
  const result = j?.message?.result;
  if (!r.ok || !result?.articleUrl && !result?.articleId) {
    const msg = j?.message?.error?.msg || j?.errorMessage || j?.message?.error?.message || text.slice(0, 400);
    const code = j?.message?.error?.code || j?.errorCode || r.status;
    const hint = String(code) === '024'
      ? ' → 네이버 계정이 카페 글쓰기 권한에 동의하지 않은 상태입니다. 클럽 설정 > 네이버 카페 연동에서 "다시 연동"을 누르고, 동의 화면에서 [선택] 카페가입, 글쓰기를 체크해주세요.'
      : '';
    throw new Error(`카페 글 등록 실패 [${code}]: ${msg}${hint}`);
  }
  return (result.articleUrl as string) || `https://cafe.naver.com/ca-fe/cafes/${cafeId}/articles/${result.articleId}`;
}

// ---------- 액션 ----------

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const { code, state, error, error_description } = req.query as Record<string, string>;
  let origin = 'https://cardio.scnd.kr';
  let clubId = '';
  try {
    const p = verifyState(state || '');
    origin = safeOrigin(p.o);
    clubId = p.c;
    if (error || !code) throw new Error(`네이버 로그인 취소/실패: ${error || ''} ${error_description || ''}`.trim());

    const t = await naverToken({ grant_type: 'authorization_code', code, state });
    let naverUserId: string | null = null;
    try {
      const me = await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${t.access_token}` } });
      naverUserId = (await me.json())?.response?.id ?? null;
    } catch (e) { console.warn('[naver-cafe] 프로필 id 조회 실패(무시):', e); }

    const { error: upErr } = await admin().from('club_naver_cafe').upsert({
      club_id: clubId,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      token_expires_at: new Date(Date.now() + Number(t.expires_in) * 1000).toISOString(),
      naver_user_id: naverUserId,
      connected_by: p.u,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'club_id' });
    if (upErr) throw new Error(`연동 정보 저장 실패: ${upErr.message}`);

    return res.redirect(`${origin}/club/settings/${clubId}/naver-cafe?naver=connected`);
  } catch (e: any) {
    console.error('[naver-cafe] 콜백 실패:', e?.message, e);
    const path = clubId ? `/club/settings/${clubId}/naver-cafe` : '/club';
    return res.redirect(`${origin}${path}?naver=error&reason=${encodeURIComponent(e?.message || String(e))}`);
  }
}

async function getStatus(clubId: string) {
  const { data, error } = await admin().from('club_naver_cafe')
    .select('cafe_id, menu_id, board_url, auto_publish, refresh_token, connected_at, connected_by')
    .eq('club_id', clubId).maybeSingle();
  if (error) throw new HttpError(500, `연동 상태 조회 실패: ${error.message}`);
  if (!data) return { connected: false };
  let connectedByName: string | null = null;
  if (data.connected_by) {
    const { data: m } = await admin().from('club_members').select('club_nickname')
      .eq('club_id', clubId).eq('user_id', data.connected_by).maybeSingle();
    connectedByName = m?.club_nickname ?? null;
  }
  return {
    connected: !!data.refresh_token,
    cafeId: data.cafe_id, menuId: data.menu_id, boardUrl: data.board_url,
    autoPublish: data.auto_publish, connectedAt: data.connected_at, connectedByName,
  };
}

async function publish(eventId: string, token: string) {
  const sb = admin();
  const { data: ev, error } = await sb.from('club_events')
    .select('id, club_id, title, starts_at, category_text, description, gpx_url, naver_cafe_article_url')
    .eq('id', eventId).maybeSingle();
  if (error || !ev) throw new HttpError(404, `행사 조회 실패: ${error?.message || '없는 행사'}`);
  await assertEventManager(ev.club_id, token);
  if (ev.naver_cafe_article_url) return { skipped: true, reason: 'already_published', articleUrl: ev.naver_cafe_article_url };

  const { data: row, error: rowErr } = await sb.from('club_naver_cafe').select('*').eq('club_id', ev.club_id).maybeSingle();
  if (rowErr) throw new HttpError(500, `연동 정보 조회 실패: ${rowErr.message}`);
  if (!row || !row.refresh_token) return { skipped: true, reason: 'not_connected' };
  if (!row.auto_publish) return { skipped: true, reason: 'auto_publish_off' };
  if (!row.cafe_id || !row.menu_id) return { skipped: true, reason: 'no_board' };

  try {
    const accessToken = await getValidAccessToken(row, ev.club_id);
    const articleUrl = await postArticle(accessToken, row.cafe_id, row.menu_id, clean(ev.title), buildContent(ev));
    await sb.from('club_events').update({
      naver_cafe_article_url: articleUrl, naver_cafe_published_at: new Date().toISOString(), naver_cafe_error: null,
    }).eq('id', eventId);
    console.log('[naver-cafe] 발행 성공', eventId, articleUrl);
    return { published: true, articleUrl };
  } catch (e: any) {
    console.error('[naver-cafe] 발행 실패', eventId, e?.message, e);
    await sb.from('club_events').update({ naver_cafe_error: String(e?.message || e).slice(0, 500) }).eq('id', eventId);
    throw new HttpError(502, e?.message || String(e));
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') return handleCallback(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action, clubId, eventId, boardUrl, autoPublish, origin } = (req.body || {}) as Record<string, any>;
    const { userId, token } = await getAppUserId(req);

    if (action === 'publish') {
      if (!eventId) throw new HttpError(400, 'eventId 가 없습니다');
      return res.status(200).json(await publish(eventId, token));
    }

    if (!clubId) throw new HttpError(400, 'clubId 가 없습니다');
    await assertClubAdmin(clubId, userId);

    if (action === 'status') return res.status(200).json(await getStatus(clubId));

    if (action === 'start') {
      const state = signState({ c: clubId, u: userId, o: safeOrigin(origin), e: Date.now() + STATE_TTL_MS });
      const qs = new URLSearchParams({
        response_type: 'code', client_id: NAVER_CLIENT_ID, redirect_uri: callbackUrl(req), state,
        // 이미 동의한 계정도 동의 화면을 다시 띄움 — 앱에 카페 권한을 나중에 추가한 경우 기존 동의엔 빠져 있어
        // 024 Scope Status Invalid 가 난다 (2026-11-12 실측)
        auth_type: 'reprompt',
      });
      return res.status(200).json({ authorizeUrl: `https://nid.naver.com/oauth2.0/authorize?${qs}` });
    }

    if (action === 'settings') {
      const patch: Record<string, unknown> = { club_id: clubId, updated_at: new Date().toISOString() };
      if (typeof boardUrl === 'string') {
        const parsed = parseBoardUrl(boardUrl);
        if (!parsed) throw new HttpError(400, '게시판 주소에서 카페ID/게시판ID 를 찾지 못했습니다. PC에서 게시판을 열고 주소창 주소를 그대로 붙여넣어주세요 (예: cafe.naver.com/f-e/cafes/31581338/menus/1)');
        patch.board_url = boardUrl.trim();
        patch.cafe_id = parsed.cafeId;
        patch.menu_id = parsed.menuId;
      }
      if (typeof autoPublish === 'boolean') patch.auto_publish = autoPublish;
      const { error } = await admin().from('club_naver_cafe').upsert(patch, { onConflict: 'club_id' });
      if (error) throw new HttpError(500, `설정 저장 실패: ${error.message}`);
      return res.status(200).json(await getStatus(clubId));
    }

    if (action === 'disconnect') {
      const { error } = await admin().from('club_naver_cafe').update({
        access_token: null, refresh_token: null, token_expires_at: null, naver_user_id: null,
        connected_by: null, connected_at: null, updated_at: new Date().toISOString(),
      }).eq('club_id', clubId);
      if (error) throw new HttpError(500, `연동 해제 실패: ${error.message}`);
      return res.status(200).json(await getStatus(clubId));
    }

    throw new HttpError(400, `알 수 없는 action: ${action}`);
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error('[naver-cafe] 실패:', status, e?.message, e);
    return res.status(status).json({ error: e?.message || String(e) });
  }
}
