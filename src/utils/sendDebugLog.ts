// 인앱 웹뷰처럼 콘솔이 안 보이는 환경에서 버튼 하나로 로그를 메일 전송.
// 서버: api/send-debug-log.ts → reshw@naver.com
export async function sendDebugLog(
  context: string,
  logs: string[],
  extra?: Record<string, unknown>,
): Promise<void> {
  const res = await fetch('/api/send-debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      screenSize: `win ${window.innerWidth}x${window.innerHeight} / screen ${window.screen.width}x${window.screen.height} / dpr ${window.devicePixelRatio}`,
      timestamp: Date.now(),
      logs,
      extra,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body}`);
  }
}
