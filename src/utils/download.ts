import html2canvas from 'html2canvas';

/**
 * 파일 저장 공통 유틸.
 *
 * 데스크톱 브라우저는 anchor + download 로 충분하지만, iOS(Safari / WKWebView)는
 * download 속성을 무시하거나 다운로드 자체를 처리하지 않는 경우가 많다.
 * 그래서 iOS 계열에서는 Web Share API 로 "사진/파일에 저장" 시트를 먼저 띄우고,
 * 안 되면 anchor → 새 탭 열기 순으로 내려간다.
 */

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ 는 데스크톱 Safari 로 위장한다
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const saveViaAnchor = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 즉시 revoke 하면 다운로드가 취소되는 사례가 있어 지연 해제
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * blob 을 파일로 저장한다.
 *
 * iOS 에서 Web Share 를 쓰려면 사용자 제스처의 activation 이 살아있어야 하므로,
 * 호출부는 캡처 등 오래 걸리는 작업 이후 **곧바로** 이 함수를 부를 것.
 */
export const saveBlob = async (blob: Blob, filename: string, mimeType?: string) => {
  const type = mimeType || blob.type || 'application/octet-stream';

  if (isIOS() && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (err: any) {
      // 사용자가 공유 시트를 닫은 것은 실패가 아니다
      if (err?.name === 'AbortError') return;
      console.warn('[다운로드] Web Share 실패, anchor 방식으로 대체:', err?.name, err?.message);
    }
  }

  saveViaAnchor(blob, filename);
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else
          reject(
            new Error(
              `canvas.toBlob 이 null 을 반환했습니다 (캔버스 ${canvas.width}x${canvas.height}). 브라우저 캔버스 크기 한계를 넘었을 가능성이 큽니다.`
            )
          );
      },
      type
    );
  });

// iOS Safari 는 캔버스 총 픽셀이 약 16.7M 을 넘으면 빈 이미지를 돌려준다.
// 여유를 둬서 12M 을 상한으로 잡고, 한 변도 4096 을 넘지 않게 한다.
const MAX_CANVAS_PIXELS = 12_000_000;
const MAX_CANVAS_SIDE = 4096;
const MIN_SCALE = 0.5;

/**
 * 스크롤 컨테이너를 통째로 캡처해 PNG blob 으로 만든다.
 *
 * - 캡처 동안만 스크롤을 풀어 전체 크기로 펼치고, 성공/실패 무관하게 원복한다.
 *   (`flex: 1` 컨테이너는 height:auto 가 무시되므로 flex 도 함께 해제)
 * - `width`/`height`/`windowWidth`/`windowHeight` 는 **넘기지 않는다.**
 *   windowWidth 를 주면 html2canvas 가 복제 문서의 뷰포트를 그 값으로 다시 잡아
 *   표 컬럼 stretch 가 재계산되고, 캔버스 폭은 그대로라 우측에 흰 여백이 생긴다.
 * - 폭을 `auto` 로 두면 옵션을 빼도 여백이 남는다. html2canvas 는 원본을 iframe 에
 *   복제해 렌더하는데, 그 안에서 `%`/`vw` 기반 폭이 다시 계산되며 표가 줄어들기 때문이다.
 *   (측정: 컨테이너 1166px → 복제본에서 표가 1044px 로 축소, 우측 122px 공백)
 *   그래서 캡처 직전에 컨테이너와 내용물의 폭을 **px 로 못박는다.** 복제본에서 재계산될 여지가 없다.
 * - `allowTaint` 는 쓰지 않는다. taint 된 캔버스는 toBlob 이 SecurityError 를 던진다.
 * - 표가 크면 scale 을 낮춰 캔버스 한계 초과를 피한다.
 */
export const captureElementToPng = async (container: HTMLElement): Promise<Blob> => {
  const content = container.firstElementChild as HTMLElement | null;
  const prev = {
    overflow: container.style.overflow,
    height: container.style.height,
    maxHeight: container.style.maxHeight,
    width: container.style.width,
    maxWidth: container.style.maxWidth,
    flex: container.style.flex,
  };
  const prevContent = content
    ? { width: content.style.width, minWidth: content.style.minWidth }
    : null;

  container.style.overflow = 'visible';
  container.style.flex = 'none';
  container.style.height = 'auto';
  container.style.maxHeight = 'none';
  container.style.width = 'auto';
  container.style.maxWidth = 'none';

  // 레이아웃 반영 대기
  await new Promise((r) => setTimeout(r, 100));

  try {
    // 컨테이너보다 내용물이 넓을 수 있다 (가로 스크롤 상태) → 둘 중 큰 쪽 기준
    const width = Math.max(container.scrollWidth, content?.scrollWidth ?? 0);
    if (!width) {
      throw new Error('캡처 대상 폭이 0 입니다. 표가 아직 렌더되지 않았습니다.');
    }

    // 복제 문서에서 폭이 다시 계산되지 않도록 px 로 고정
    container.style.width = `${width}px`;
    if (content) {
      content.style.width = `${width}px`;
      content.style.minWidth = `${width}px`;
    }
    await new Promise((r) => setTimeout(r, 50));

    const height = container.scrollHeight;
    if (!height) {
      throw new Error(`캡처 대상 높이가 0 입니다 (${width}x${height}).`);
    }

    const scale = Math.min(
      2,
      Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
      MAX_CANVAS_SIDE / Math.max(width, height)
    );

    if (scale < MIN_SCALE) {
      throw new Error(
        `표가 너무 커서 이미지로 만들 수 없습니다 (${width}x${height}px). 엑셀 다운로드를 이용해 주세요.`
      );
    }

    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
    });

    return await canvasToBlob(canvas, 'image/png');
  } finally {
    Object.assign(container.style, prev);
    if (content && prevContent) Object.assign(content.style, prevContent);
  }
};

/** 실패 원인을 사용자에게 그대로 보여주기 위한 메시지 추출 */
export const describeError = (err: any): string =>
  err?.message || err?.error_description || err?.hint || (typeof err === 'string' ? err : JSON.stringify(err));
