import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const { data: integration, error: dbError } = await supabase
    .from('user_integrations')
    .select('id, provider_user_id, access_token, refresh_token, token_expires_at, scope')
    .eq('user_id', String(user_id))
    .eq('provider', 'strava')
    .single();

  if (dbError || !integration) {
    return res.status(200).json({ error: 'integration not found', dbError });
  }

  const tokenInfo = {
    provider_user_id: integration.provider_user_id,
    scope: integration.scope,
    expires_at: integration.token_expires_at,
    expired: new Date(integration.token_expires_at) <= new Date(),
    token_last6: integration.access_token?.slice(-6),
  };

  // /athlete 호출로 토큰 유효성 확인
  const athleteRes = await fetch('https://www.api-v3.strava.com/athlete', {
    headers: { Authorization: `Bearer ${integration.access_token}` },
  });
  const athleteBody = await athleteRes.text();

  // 최근 활동 1개 가져오기 시도
  const activitiesRes = await fetch('https://www.api-v3.strava.com/athlete/activities?per_page=1', {
    headers: { Authorization: `Bearer ${integration.access_token}` },
  });
  const activitiesBody = await activitiesRes.text();

  return res.status(200).json({
    token: tokenInfo,
    athlete: { status: athleteRes.status, body: JSON.parse(athleteBody) },
    activities: { status: activitiesRes.status, body: activitiesBody.slice(0, 500) },
  });
}
