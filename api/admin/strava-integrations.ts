import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', userId)
    .single();
  return !!data?.is_super_admin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { caller_id } = req.query;
  if (!caller_id) return res.status(401).json({ error: 'caller_id required' });
  if (!(await verifySuperAdmin(String(caller_id)))) {
    return res.status(403).json({ error: 'Super admin only' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_integrations')
      .select(`
        id,
        user_id,
        provider_user_id,
        access_token,
        token_expires_at,
        athlete_name,
        athlete_profile,
        created_at,
        users!inner(display_name, profile_image)
      `)
      .eq('provider', 'strava')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ integrations: data });
  }

  if (req.method === 'DELETE') {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    // 현재 access_token 조회 (Strava deauthorize용)
    const { data: integration } = await supabase
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', String(user_id))
      .eq('provider', 'strava')
      .single();

    // Strava deauthorize
    let stravaResult = 'not_attempted';
    if (integration?.access_token) {
      try {
        const deauthRes = await fetch('https://www.strava.com/oauth/deauthorize', {
          method: 'POST',
          headers: { Authorization: `Bearer ${integration.access_token}` },
        });
        stravaResult = deauthRes.ok ? 'success' : `failed(${deauthRes.status})`;
      } catch {
        stravaResult = 'error';
      }
    }

    const { error } = await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', String(user_id))
      .eq('provider', 'strava');

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, strava_deauth: stravaResult });
  }

  return res.status(405).end();
}
