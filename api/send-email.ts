import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// 어드민 이메일은 service_role 로 서버에서만 조회한다.
// 클라이언트는 users.email 을 읽을 수 없고 수신자도 지정할 수 없다.
// (docs/plans/rls-hardening.md §3-3)
async function fetchAdminEmails(): Promise<string[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      `Supabase 환경변수 누락: VITE_SUPABASE_URL=${!!url}, SUPABASE_SERVICE_ROLE_KEY=${!!serviceKey}`
    );
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .eq('is_admin', true)
    .is('deleted_at', null)
    .not('email', 'is', null);

  if (error) {
    throw new Error(`어드민 이메일 조회 실패: ${error.message} (${error.code || 'no-code'})`);
  }

  return (data || []).map((u: { email: string | null }) => u.email).filter((e): e is string => !!e);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, ...body } = req.body as Record<string, string>;

    if (type === 'club-request') {
      const { clubName, clubDescription, creatorName } = body;
      if (!clubName || !creatorName) {
        return res.status(400).json({ error: 'Missing required fields: clubName, creatorName' });
      }

      const adminEmails = await fetchAdminEmails();
      if (adminEmails.length === 0) {
        console.warn('⚠️ 클럽 신청 알림: 수신 가능한 어드민 이메일이 없습니다');
        return res.status(200).json({ success: true, sent: 0, reason: 'no admin recipients' });
      }

      const siteUrl = process.env.URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
      const { data, error } = await resend.emails.send({
        from: 'Cardio Club <ai@scnd.kr>',
        to: adminEmails,
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

    if (type === 'tester-application') {
      const { email, timestamp } = body;
      if (!email) return res.status(400).json({ error: 'Missing required fields' });
      const { error } = await resend.emails.send({
        from: 'Cardio Club <ai@scnd.kr>',
        to: ['reshw@naver.com'],
        subject: `📱 Play 비공개 테스트 신청: ${email}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3DDC84;">Play 비공개 테스트 신청</h2>
            <div style="background: #F8FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 10px 0;"><strong>Google Play 계정 이메일:</strong> ${email}</p>
              <p style="margin: 10px 0;"><strong>신청 시각:</strong> ${timestamp ? new Date(timestamp).toLocaleString('ko-KR') : '알 수 없음'}</p>
            </div>
            <p>비공개 테스트 이메일 목록에 수동으로 추가한 뒤 신청자에게 개별 연락해주세요.</p>
          </div>
        `,
      });
      if (error) return res.status(500).json({ error: 'Email sending failed', details: error });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (error) {
    console.error('send-email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
