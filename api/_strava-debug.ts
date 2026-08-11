import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshToken(integration: {
  id: string;
  refresh_token: string;
}): Promise<{ access_token: string; expires_at: string } | null> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: integration.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const expires_at = new Date(data.expires_at * 1000).toISOString();
  await supabase.from('user_integrations').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: expires_at,
    updated_at: new Date().toISOString(),
  }).eq('id', integration.id);
  return { access_token: data.access_token, expires_at };
}

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

  const isExpired = new Date(integration.token_expires_at) <= new Date();
  let accessToken = integration.access_token;
  let refreshResult: string | null = null;

  if (isExpired) {
    const refreshed = await refreshToken(integration);
    if (refreshed) {
      accessToken = refreshed.access_token;
      refreshResult = `refreshed → new expires_at: ${refreshed.expires_at}`;
    } else {
      refreshResult = 'FAILED';
    }
  }

  const tokenInfo = {
    provider_user_id: integration.provider_user_id,
    scope: integration.scope,
    expires_at: integration.token_expires_at,
    was_expired: isExpired,
    refresh: refreshResult ?? 'not needed',
    token_last6: accessToken?.slice(-6),
  };

  const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const athleteBody = await athleteRes.text();

  const activitiesRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=1', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const activitiesBody = await activitiesRes.text();

  return res.status(200).json({
    token: tokenInfo,
    athlete: { status: athleteRes.status, body: JSON.parse(athleteBody) },
    activities: { status: activitiesRes.status, body: activitiesBody.slice(0, 500) },
  });
}
