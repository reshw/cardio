/**
 * 공유 폴백.
 *
 * 왜 필요한가: 카카오 JS SDK(`Kakao.Share.sendDefault`)는 내부적으로 `kakaolink://` 커스텀
 * 스킴으로 카톡 앱을 띄우는데, **네이티브 앱 WebView 안에서는 네이티브가 스킴 이동을 직접
 * 처리해주지 않으면 그 네비게이션이 그냥 삼켜진다** (iOS decidePolicyFor / Android
 * shouldOverrideUrlLoading). 즉 앱 안에서 공유 버튼이 무반응이 된다.
 * (WebView 에서 window.confirm() 이 조용히 무시되던 것과 같은 계열의 문제 — useConfirm.tsx 참고)
 *
 * ⚠️ 2026-08-28 최초 배포 버전은 이 순서를 모든 환경에 동일하게 적용했다가 회귀를 냈다
 * (2026-08-29 다수 민원으로 발견): navigator.share(Web Share API)가 안드로이드 Chrome·
 * iOS Safari 대부분에 이미 있어서, **정상 브라우저로 접속한 대다수 사용자**가 카카오
 * 전용 피드 카드(이미지+제목+설명+버튼) 대신 OS 기본 공유시트로 빠져버렸다 — 카톡을
 * 골라도 밋밋한 링크 텍스트만 전달됨. WebView 무반응 문제는 실제로는 native app
 * 안에서만 일어나므로, `isNativeApp()` 으로 분기해서 그 환경에서만 순서를 바꾼다.
 *
 *   네이티브 앱 WebView (isNativeApp() === true) — kakaolink:// 가 안 먹으니 우회:
 *     1. CardioNative.share  — OS 공유 시트 (앱 안. 카톡·문자·복사 전부 커버)
 *     2. navigator.share     — Web Share API (iOS WKWebView. Android WebView 미지원)
 *     3. Kakao.Share
 *     4. 클립보드
 *
 *   일반 브라우저 (그 외 전부) — 예전부터 잘 동작하던 카카오 카드 그대로 1순위:
 *     1. CardioNative.share  — 원래 항상 undefined 라 사실상 안 탐
 *     2. Kakao.Share         — 일반 모바일/데스크톱 브라우저
 *     3. navigator.share
 *     4. 클립보드            — 무조건 성공하는 바닥
 *
 * 설계: docs/plans/kakao-invite-app-onboarding.md
 */

import { isNativeApp } from './browserEnv';

/** 어느 수단으로 공유됐는지. 호출부는 'clipboard' 일 때만 안내 문구를 띄운다 —
 *  나머지는 OS/카톡이 자기 UI 를 띄우므로 우리가 덧붙이면 중복이다. */
export type ShareResult = 'native' | 'webshare' | 'kakao' | 'clipboard';

interface ShareContentArgs {
  url: string;
  /** 공유 본문 (클립보드·OS 공유 시트용) */
  text: string;
  title: string;
  /** 카카오 SDK 전용 페이로드 — 3순위에서만 쓰인다 */
  kakaoPayload: Record<string, unknown>;
}

const copyToClipboard = async (value: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  // http/구형 WebView 폴백
  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

const tryKakao = (kakaoPayload: Record<string, unknown>): ShareResult | null => {
  if (!window.Kakao?.isInitialized?.()) return null;
  try {
    window.Kakao.Share.sendDefault(kakaoPayload);
    return 'kakao';
  } catch (err: any) {
    console.error('[공유] 카카오 공유 실패, 다음 수단으로:', JSON.stringify(err), err);
    return null;
  }
};

const tryWebShare = async (title: string, text: string, url: string): Promise<ShareResult | null> => {
  if (typeof navigator.share !== 'function') return null;
  try {
    await navigator.share({ title, text, url });
    return 'webshare';
  } catch (err: any) {
    // 사용자가 공유 시트를 닫은 것은 실패가 아니다 — 다른 수단으로 또 띄우면 안 된다
    if (err?.name === 'AbortError') return 'webshare';
    console.warn('[공유] Web Share 실패, 다음 수단으로:', err?.name, err?.message);
    return null;
  }
};

export async function shareContent({ url, text, title, kakaoPayload }: ShareContentArgs): Promise<ShareResult> {
  // 네이티브 공유 시트 — 브릿지가 있을 때만 (일반 브라우저에선 항상 undefined라 안 탐)
  if (window.CardioNative?.share) {
    try {
      window.CardioNative.share({ url, text, title });
      return 'native';
    } catch (err: any) {
      console.error('[공유] 네이티브 share 실패, 다음 수단으로:', JSON.stringify(err), err);
    }
  }

  if (isNativeApp()) {
    // 네이티브 앱 WebView — 카카오 SDK가 kakaolink:// 를 못 띄워 무반응이므로 Web Share 우선
    const webshareResult = await tryWebShare(title, text, url);
    if (webshareResult) return webshareResult;
    const kakaoResult = tryKakao(kakaoPayload);
    if (kakaoResult) return kakaoResult;
  } else {
    // 일반 브라우저 — 카카오 전용 카드(이미지+제목+설명+버튼)가 정상 동작하므로 그대로 1순위
    const kakaoResult = tryKakao(kakaoPayload);
    if (kakaoResult) return kakaoResult;
    const webshareResult = await tryWebShare(title, text, url);
    if (webshareResult) return webshareResult;
  }

  // 바닥 — 클립보드
  await copyToClipboard(`${text}\n${url}`);
  return 'clipboard';
}

// ============================================================================
// 클럽 초대
// ============================================================================

interface InviteClub {
  name: string;
  invite_code: string;
  logo_url?: string | null;
}

/** 초대 게이트웨이 URL — 카카오로 받은 사람의 환경(앱/카톡인앱/iOS/Android)을 판별해 인계한다 */
export const buildInviteUrl = (inviteCode: string): string =>
  `${window.location.origin}/i/${inviteCode}`;

export function shareClubInvite(club: InviteClub): Promise<ShareResult> {
  const url = buildInviteUrl(club.invite_code);
  const text = `${club.name} 클럽에 초대합니다!\n함께 운동하며 건강한 습관을 만들어봐요 💪`;

  const kakaoPayload: any = {
    objectType: 'feed',
    content: {
      title: `🏃 ${club.name} 클럽 초대`,
      description: `${club.name} 클럽에 초대합니다!\n앱을 설치하면 운동 기록이 자동으로 연동돼요 💪`,
      link: { mobileWebUrl: url, webUrl: url },
    },
    // feed 템플릿은 버튼 2개까지 지원한다. 설치 경로를 별도 버튼으로 노출.
    buttons: [
      { title: '클럽 가입하기', link: { mobileWebUrl: url, webUrl: url } },
      { title: '앱 설치하기', link: { mobileWebUrl: `${url}?to=install`, webUrl: `${url}?to=install` } },
    ],
  };
  if (club.logo_url) kakaoPayload.content.imageUrl = club.logo_url;

  return shareContent({ url, text, title: `${club.name} 클럽 초대`, kakaoPayload });
}

// ============================================================================
// 운동 기록
// ============================================================================

interface WorkoutShareArgs {
  workoutId: string;
  clubId: string;
  clubName: string;
  nickname: string;
  dateStr: string;
  /** 예: "러닝-야외" */
  workoutLabel: string;
  value: number | string;
  unit: string;
  workoutNumber?: number | null;
  proofImage?: string | null;
}

export function shareWorkout(args: WorkoutShareArgs): Promise<ShareResult> {
  const url = `${window.location.origin}/workout/${args.workoutId}?clubId=${args.clubId}`;
  const numberText = args.workoutNumber ? `\n오늘 클럽 ${args.workoutNumber}번째` : '';
  const title = `[${args.clubName}] ${args.nickname}님 (${args.dateStr})`;
  const text = `${args.workoutLabel}: ${args.value}${args.unit}${numberText}`;

  const kakaoPayload: any = {
    objectType: 'feed',
    content: {
      title,
      description: text,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: '나도 기록하기', link: { mobileWebUrl: url, webUrl: url } }],
  };
  if (args.proofImage) kakaoPayload.content.imageUrl = args.proofImage;

  return shareContent({ url, text, title, kakaoPayload });
}
