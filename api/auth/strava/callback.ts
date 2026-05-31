import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const frontendUrl = process.env.FRONTEND_URL || 'https://cardio.reshw.com';
  const { code, state: userId, error } = req.query;

  if (error || !code || !userId) {
    return res.redirect(`${frontendUrl}/more?strava=error&reason=${error || 'missing_params'}`);
  }

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('Strava token exchange failed:', await tokenRes.text());
      return res.redirect(`${frontendUrl}/more?strava=error&reason=token_exchange`);
    }

    const { athlete, access_token, refresh_token, expires_at } = await tokenRes.json();

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.redirect(`${frontendUrl}/more?strava=error&reason=invalid_user`);
    }

    const { error: upsertError } = await supabase
      .from('user_integrations')
      .upsert(
        {
          user_id: userId,
          provider: 'strava',
          provider_user_id: String(athlete.id),
          access_token,
          refresh_token,
          token_expires_at: new Date(expires_at * 1000).toISOString(),
          scope: 'activity:read_all',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider' }
      );

    if (upsertError) {
      console.error('DB upsert failed:', upsertError);
      return res.redirect(`${frontendUrl}/more?strava=error&reason=db_error`);
    }

    return res.redirect(`${frontendUrl}/more?strava=connected`);
  } catch (err) {
    console.error('Strava callback error:', err);
    return res.redirect(`${frontendUrl}/more?strava=error&reason=server_error`);
  }
}
