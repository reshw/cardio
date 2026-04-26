import { Handler } from '@netlify/functions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { adminEmail, clubId, clubName, year, month, errorMessage } = JSON.parse(event.body || '{}');

    if (!adminEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const { data, error } = await resend.emails.send({
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

    if (error) {
      console.error('❌ Resend 이메일 발송 실패:', error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email sending failed' }) };
    }

    console.log('✅ 마일리지 알림 이메일 발송 성공:', data);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('❌ 함수 실행 실패:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
