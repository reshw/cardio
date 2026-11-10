/**
 * 공유 폴백.
 *
 * 목표는 언제나 **카카오 피드 카드**(이미지+제목+설명+버튼)다. `Kakao.Share.sendDefault` 가
 * 이걸 만든다. 나머지는 카카오가 불가능할 때의 폴백.
 *
 * 순서 (2026-09-03 기준):
 *   1. Kakao.Share.sendDefault  — 카카오 피드 카드. 환경 분기 없이 항상 먼저.
 *   2. navigator.share          — Web Share API (모바일 Safari·iOS WKWebView. Android WebView 미지원)
 *   3. CardioNative.share       — 네이티브 OS 공유 시트 (앱 안 폴백). 주로 Android WebView 가 여기서 잡힘.
 *   4. 클립보드                 — 무조건 성공하는 바닥
 *
 * ## 왜 CardioNative.share 가 1순위가 아니라 3순위인가
 *
 * 카카오 JS SDK 는 `kakaolink://` 커스텀 스킴으로 카톡을 여는데, 앱 WebView 가 그 스킴을
 * 네이티브로 넘겨주지 않으면 조용히 삼켜진다. 그래서 and/app 이 2026-09-01 에
 * `CardioNative.share`(iOS `UIActivityViewController` / Android `Intent.ACTION_SEND`)를
 * 구현했고 web 은 그걸 1순위로 뒀다.
 *
 * 그런데 OS 공유 시트로 카톡을 고르면 iOS/Android 둘 다 **이미지·텍스트를 별개 아이템으로**
 * 카톡에 넘겨서 피드 카드가 안 만들어지고 조각조각 전달된다 (사용자 민원, cardio-comms #109).
 *
 * app 이 다음 릴리즈에서 `kakaolink://` 스킴 통과를 배포하면(WKWebView `decidePolicyFor` →
 * `UIApplication.open`) iOS 앱 안에서도 1)의 카카오 SDK 가 그대로 예쁜 카드를 만든다 → 그때는
 * `CardioNative.share` 가 아예 안 불린다 (app #111). Android(`and`)도 같은 스킴 통과 요청 중.
 *
 * 그때까지의 임시 상태: 앱 안에서는 1)이 조용히 실패 → 2)/3) 로 내려가 "카드는 아니지만 동작".
 *
 * 설계: docs/plans/kakao-invite-app-onboarding.md · cardio-comms #109~#111
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
  // 1) 카카오 피드 카드(이미지+제목+설명+버튼) — 이 앱 공유의 기본 형태. 환경 분기 없이 먼저.
  const kakaoResult = tryKakao(kakaoPayload);
  if (kakaoResult) return kakaoResult;

  // 2) Web Share API (iOS WKWebView·모바일 Safari 대부분 지원, Android WebView 미지원)
  const webshareResult = await tryWebShare(title, text, url);
  if (webshareResult) return webshareResult;

  // 3) 네이티브 OS 공유 시트 — 위 둘이 다 실패한 "앱 안" 폴백.
  //    이전엔 이게 1순위였는데, iOS(UIActivityVC)/Android(ACTION_SEND) 둘 다 카톡에
  //    이미지·텍스트를 별개 아이템으로 넘겨서 카카오가 피드 카드를 못 만들고 조각조각 전달됐다.
  //    지금은 폴백으로 내림 — 주로 Android WebView(navigator.share 미지원)가 여기서 잡힌다.
  //    iOS 는 app 이 kakaolink:// 스킴 통과를 배포하면(cardio-comms #111) 1)에서 잡히므로 여기 안 옴.
  if (window.CardioNative?.share) {
    try {
      window.CardioNative.share({ url, text, title });
      return 'native';
    } catch (err: any) {
      console.error('[공유] 네이티브 share 실패, 다음 수단으로:', JSON.stringify(err), err);
    }
  }

  // 4) 바닥 — 클립보드
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
