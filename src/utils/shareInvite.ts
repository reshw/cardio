/**
 * 공유 4단 폴백.
 *
 * 왜 필요한가: 카카오 JS SDK(`Kakao.Share.sendDefault`)는 내부적으로 `kakaolink://` 커스텀
 * 스킴으로 카톡 앱을 띄우는데, **네이티브 앱 WebView 안에서는 네이티브가 스킴 이동을 직접
 * 처리해주지 않으면 그 네비게이션이 그냥 삼켜진다** (iOS decidePolicyFor / Android
 * shouldOverrideUrlLoading). 즉 앱 안에서 공유 버튼이 무반응이 된다.
 * (WebView 에서 window.confirm() 이 조용히 무시되던 것과 같은 계열의 문제 — useConfirm.tsx 참고)
 *
 * 그래서 환경별로 알아서 내려간다. 네이티브가 아무것도 안 해줘도 최소 클립보드까지는 도달한다:
 *   1. CardioNative.share  — OS 공유 시트 (앱 안. 카톡·문자·복사 전부 커버)
 *   2. navigator.share     — Web Share API (iOS WKWebView·모바일 Safari. Android WebView 미지원)
 *   3. Kakao.Share         — 일반 모바일/데스크톱 브라우저
 *   4. 클립보드            — 무조건 성공하는 바닥
 *
 * 설계: docs/plans/kakao-invite-app-onboarding.md
 */

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

export async function shareContent({ url, text, title, kakaoPayload }: ShareContentArgs): Promise<ShareResult> {
  // 1순위 — 네이티브 공유 시트
  if (window.CardioNative?.share) {
    try {
      window.CardioNative.share({ url, text, title });
      return 'native';
    } catch (err: any) {
      console.error('[공유] 네이티브 share 실패, 다음 수단으로:', JSON.stringify(err), err);
    }
  }

  // 2순위 — Web Share API
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'webshare';
    } catch (err: any) {
      // 사용자가 공유 시트를 닫은 것은 실패가 아니다 — 다른 수단으로 또 띄우면 안 된다
      if (err?.name === 'AbortError') return 'webshare';
      console.warn('[공유] Web Share 실패, 다음 수단으로:', err?.name, err?.message);
    }
  }

  // 3순위 — 카카오 JS SDK
  if (window.Kakao?.isInitialized?.()) {
    try {
      window.Kakao.Share.sendDefault(kakaoPayload);
      return 'kakao';
    } catch (err: any) {
      console.error('[공유] 카카오 공유 실패, 클립보드로:', JSON.stringify(err), err);
    }
  }

  // 4순위 — 클립보드
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
