import { Handler } from '@netlify/functions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler: Handler = async (event) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { adminEmail, clubName, clubDescription, creatorName } = JSON.parse(event.body || '{}');

    if (!adminEmail || !clubName || !creatorName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // 이메일 발송
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

          <a href="${process.env.URL || 'http://localhost:5173'}/admin/club-approval"
             style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #4FC3F7 0%, #FF6B9D 100%); color: white; text-decoration: none; border-radius: 8px; margin-top: 20px;">
            어드민 페이지로 이동
          </a>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Resend 이메일 발송 실패:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Email sending failed', details: error }),
      };
    }

    console.log('✅ 어드민 이메일 발송 성공:', data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data }),
    };
  } catch (error) {
    console.error('❌ 함수 실행 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error }),
    };
  }
};
