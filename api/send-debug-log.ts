import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// 범용 디버그 로그 메일 전송 — 인앱 웹뷰처럼 콘솔 접근이 안 되는 환경에서
// 사용자가 버튼 한 번으로 로그를 reshw@naver.com 으로 보낼 수 있게 한다.
// (로그인 진단은 별도: api/send-login-diagnostic.ts)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { context, userAgent, url, screenSize, timestamp, logs, extra } = req.body ?? {};
    const logLines: string[] = Array.isArray(logs) ? logs.map(String) : [];
    const when = timestamp ? new Date(timestamp) : new Date();
    const esc = (s: unknown) =>
      String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));

    const { error } = await resend.emails.send({
      from: 'Cardio Club <ai@scnd.kr>',
      to: ['reshw@naver.com'],
      subject: `🐛 디버그 로그 — ${esc(context) || '(context 없음)'} — ${when.toLocaleString('ko-KR')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="color: #1565c0;">디버그 로그 수신</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; font-size: 13px; line-height: 1.8;">
            <p><strong>Context:</strong> ${esc(context)}</p>
            <p><strong>시각:</strong> ${when.toLocaleString('ko-KR')}</p>
            <p><strong>URL:</strong> ${esc(url)}</p>
            <p><strong>화면 크기:</strong> ${esc(screenSize)}</p>
            <p style="word-break: break-all;"><strong>User-Agent:</strong><br>${esc(userAgent)}</p>
            ${extra ? `<p style="word-break: break-all;"><strong>Extra:</strong><br><code>${esc(JSON.stringify(extra))}</code></p>` : ''}
          </div>
          ${logLines.length > 0 ? `
          <h3 style="margin-top: 24px;">로그 (${logLines.length}개)</h3>
          <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; font-size: 12px; line-height: 1.6; overflow-x: auto; white-space: pre-wrap;">${esc(logLines.join('\n'))}</pre>
          ` : '<p style="color:#888; font-size:13px;">로그 없음</p>'}
        </div>
      `,
    });

    if (error) {
      console.error('send-debug-log Resend 실패:', JSON.stringify(error));
      return res.status(500).json({ error: `Email sending failed: ${error.message || JSON.stringify(error)}` });
    }
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('send-debug-log 실패:', JSON.stringify(error), error);
    return res.status(500).json({ error: `Internal server error: ${error?.message || String(error)}` });
  }
}
