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
    const { type, ...body } = req.body as Record<string, string>;

    if (type === 'club-request') {
      const { adminEmail, clubName, clubDescription, creatorName } = body;
      if (!adminEmail || !clubName || !creatorName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const siteUrl = process.env.URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
      const { data, error } = await resend.emails.send({
        from: 'Cardio Club <ai@scnd.kr>',
        to: [adminEmail],
        subject: `🏃 새로운 클럽 생성 신청: ${clubName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4FC3F7;">새로운 클럽 생성 신청</h2>
            <div style="background: #F8FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 10px 0;"><strong>클럽명:</strong> ${clubName}</p>
              <p style="margin: 10px 0;"><strong>설명:</strong> ${clubDescription || '없음'}</p>
              <p style="margin: 10px 0;"><strong>신청자:</strong> ${creatorName}</p>
            </div>
            <p>어드민 페이지에서 승인/거부를 진행해주세요.</p>
            <a href="${siteUrl}/admin/club-approval"
               style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%); color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">
              어드민 페이지로 이동
            </a>
          </div>
        `,
      });
      if (error) return res.status(500).json({ error: 'Email sending failed', details: error });
      return res.status(200).json({ success: true, data });
    }

    if (type === 'mileage-alert') {
      const { adminEmail, clubId, clubName, year, month, errorMessage } = body;
      if (!adminEmail) return res.status(400).json({ error: 'Missing required fields' });
      const { error } = await resend.emails.send({
        from: 'Cardio Club <ai@scnd.kr>',
        to: [adminEmail],
        subject: `⚠️ 마일리지 스냅샷 오류: ${clubName || clubId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B9D;">⚠️ 마일리지 스냅샷 자동 재계산 실패</h2>
            <div style="background: #FFF0F0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF6B9D;">
              <p style="margin: 10px 0;"><strong>클럽:</strong> ${clubName || '알 수 없음'} (${clubId})</p>
              <p style="margin: 10px 0;"><strong>기간:</strong> ${year}년 ${month}월</p>
              <p style="margin: 10px 0;"><strong>오류:</strong> ${errorMessage || '알 수 없는 오류'}</p>
            </div>
            <p>마일리지 스냅샷과 실제 운동 기록이 불일치하여 자동 재계산을 시도했으나 실패했습니다.</p>
            <p>클럽 메뉴 → <strong>마일리지 재계산</strong>을 수동으로 실행해주세요.</p>
          </div>
        `,
      });
      if (error) return res.status(500).json({ error: 'Email sending failed' });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    console.error('send-email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
