import { Resend } from 'npm:resend';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, content, senderName, senderEmail, senderPhone } = await req.json();

    if (!title || !content) {
      return new Response(JSON.stringify({ error: '제목과 내용은 필수입니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    await resend.emails.send({
      from: 'CardioApp <noreply@scnd.kr>',
      to: 'reshw@naver.com',
      subject: `[CardioApp 피드백] ${title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${title}</h2>
          <div style="margin: 8px 0; font-size: 13px; color: #888; line-height: 1.8;">
            <span>보낸 사람: <strong>${senderName || '알 수 없음'}</strong></span><br/>
            ${senderPhone ? `<span>휴대폰: ${senderPhone}</span><br/>` : ''}
            ${senderEmail ? `<span>이메일: ${senderEmail}</span>` : ''}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <div style="font-size: 15px; line-height: 1.6; color: #333;">
            ${content}
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: '전송에 실패했습니다.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
