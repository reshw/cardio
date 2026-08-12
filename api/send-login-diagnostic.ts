import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userAgent, url, origin, inAppKind, sessionExists, sessionError, screenSize, timestamp, logs } = req.body;
    const logLines: string[] = Array.isArray(logs) ? logs : [];

    const { error } = await resend.emails.send({
      from: 'Cardio Club <ai@scnd.kr>',
      to: ['reshw@naver.com'],
      subject: `🚨 로그인 오류 접수 — ${new Date(timestamp).toLocaleString('ko-KR')}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">로그인 오류 진단 접수</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; font-size: 13px; line-height: 1.8;">
            <p><strong>시각:</strong> ${new Date(timestamp).toLocaleString('ko-KR')}</p>
            <p><strong>URL:</strong> ${url}</p>
            <p><strong>Origin:</strong> ${origin}</p>
            <p><strong>인앱 브라우저:</strong> ${inAppKind || '아니요'}</p>
            <p><strong>세션 존재:</strong> ${sessionExists ? '있음' : '없음'}</p>
            <p><strong>세션 에러:</strong> ${sessionError || '없음'}</p>
            <p><strong>화면 크기:</strong> ${screenSize}</p>
            <p style="word-break: break-all;"><strong>User-Agent:</strong><br>${userAgent}</p>
          </div>
          ${logLines.length > 0 ? `
          <h3 style="margin-top: 24px;">플로우 로그 (${logLines.length}개)</h3>
          <pre style="background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; font-size: 12px; line-height: 1.6; overflow-x: auto; white-space: pre-wrap;">${logLines.join('\n')}</pre>
          ` : '<p style="color:#888; font-size:13px;">로그 없음 (로그인 시도 전 접수)</p>'}
        </div>
      `,
    });

    if (error) return res.status(500).json({ error: 'Email sending failed' });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('send-login-diagnostic 실패:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
