import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ValueSource = 'distance_km' | 'distance_m' | 'elapsed_min';

interface StravaMapping {
  category: string;
  sub_type: string | null;
  unit: string;
  value_source: ValueSource;
}

const STRAVA_TYPE_MAP: Record<string, StravaMapping | null> = {
  Run:               { category: '달리기', sub_type: '러닝',       unit: 'km', value_source: 'distance_km' },
  TrailRun:          { category: '달리기', sub_type: '러닝',       unit: 'km', value_source: 'distance_km' },
  VirtualRun:        { category: '달리기', sub_type: '트레드밀',   unit: 'km', value_source: 'distance_km' },
  Ride:              { category: '사이클', sub_type: '실외',       unit: 'km', value_source: 'distance_km' },
  VirtualRide:       { category: '사이클', sub_type: '실내',       unit: 'km', value_source: 'distance_km' },
  MountainBikeRide:  { category: '사이클', sub_type: '실외',       unit: 'km', value_source: 'distance_km' },
  GravelRide:        { category: '사이클', sub_type: '실외',       unit: 'km', value_source: 'distance_km' },
  EBikeRide:         { category: '사이클', sub_type: '전기자전거', unit: 'km', value_source: 'distance_km' },
  EMountainBikeRide: { category: '사이클', sub_type: '전기자전거', unit: 'km', value_source: 'distance_km' },
  Swim:              { category: '수영',   sub_type: '풀수영',     unit: 'm',  value_source: 'distance_m'  },
  OpenWaterSwim:     { category: '수영',   sub_type: '오픈워터',   unit: 'm',  value_source: 'distance_m'  },
  Rowing:            { category: '로잉',   sub_type: '실외',       unit: 'km', value_source: 'distance_km' },
  VirtualRow:        { category: '로잉',   sub_type: '실내',       unit: 'km', value_source: 'distance_km' },
  Yoga:              { category: '요가',   sub_type: '하타',       unit: '분', value_source: 'elapsed_min' },
  WeightTraining:    { category: '헬스',   sub_type: null,          unit: '분', value_source: 'elapsed_min' },
  Crossfit:          { category: '헬스',   sub_type: null,          unit: '분', value_source: 'elapsed_min' },
};

// ═══════════════════════════════════════════════════════════
// Token refresh
// ═══════════════════════════════════════════════════════════

async function refreshToken(integration: {
  id: string;
  refresh_token: string;
}): Promise<string | null> {
  console.log('Refreshing token for integration:', integration.id, '| client_id set:', !!process.env.STRAVA_CLIENT_ID);
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
  if (!res.ok) {
    console.error('Token refresh failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  console.log('Token refresh OK — new expires_at:', new Date(data.expires_at * 1000).toISOString(), '| has access_token:', !!data.access_token);
  await supabase.from('user_integrations').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(data.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', integration.id);
  return data.access_token;
}

async function getValidToken(integration: {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}): Promise<string | null> {
  const expired = new Date(integration.token_expires_at) <= new Date(Date.now() + 60_000);
  console.log('getValidToken — expires_at:', integration.token_expires_at, '| expired:', expired);
  if (!expired) return integration.access_token;
  return refreshToken(integration);
}

async function fetchActivity(activityId: number, integration: {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}): Promise<any | null> {
  const token = await getValidToken(integration);
  if (!token) return null;

  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    console.warn(`Activity fetch 401 for ${activityId} — forcing token refresh`);
    const newToken = await refreshToken(integration);
    if (!newToken) return null;
    const retry = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (!retry.ok) {
      console.error('Activity fetch failed after refresh:', activityId, retry.status, await retry.text());
      return null;
    }
    return retry.json();
  }

  if (!res.ok) {
    console.error('Activity fetch failed:', activityId, res.status, await res.text());
    console.error('Token used (last 6):', token.slice(-6), '| expires_at:', integration.token_expires_at);
    return null;
  }

  return res.json();
}

// ═══════════════════════════════════════════════════════════
// Webhook handler
// ═══════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;
    if (verifyToken !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) return res.status(403).json({ error: 'Invalid verify token' });
    return res.status(200).json({ 'hub.challenge': challenge });
  }

  if (req.method === 'POST') {
    const { object_type, object_id, owner_id, aspect_type } = req.body as {
      object_type: string; object_id: number; owner_id: number; aspect_type: 'create' | 'update' | 'delete';
    };

    if (object_type !== 'activity') return res.status(200).end();

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('id, user_id, access_token, refresh_token, token_expires_at')
      .eq('provider', 'strava')
      .eq('provider_user_id', String(owner_id))
      .single();

    if (!integration) return res.status(200).end();

    if (aspect_type === 'delete') {
      await supabase.from('workouts').delete()
        .eq('user_id', integration.user_id).eq('source', 'strava').eq('source_activity_id', String(object_id));
      return res.status(200).end();
    }

    if (aspect_type !== 'create' && aspect_type !== 'update') return res.status(200).end();

    const activity = await fetchActivity(object_id, integration);
    if (!activity) return res.status(200).end();

    const mapping = STRAVA_TYPE_MAP[activity.type as string];
    if (!mapping) { console.log('No mapping for type:', activity.type); return res.status(200).end(); }

    let value: number;
    if (mapping.value_source === 'distance_km') value = Math.round((activity.distance / 1000) * 100) / 100;
    else if (mapping.value_source === 'distance_m') value = Math.round(activity.distance);
    else value = Math.round(activity.elapsed_time / 60);
    if (value <= 0) return res.status(200).end();

    const stravaMetrics = {
      elapsed_seconds: activity.elapsed_time ?? null,
      moving_seconds: activity.moving_time ?? null,
      average_speed: activity.average_speed ?? null,
      average_heartrate: activity.average_heartrate ?? null,
      device_name: activity.device_name ?? null,
      timezone: activity.timezone ?? null,
      utc_offset: activity.utc_offset != null ? Math.round(activity.utc_offset) : null,
    };

    const workoutData = {
      user_id: integration.user_id,
      category: mapping.category,
      sub_type: mapping.sub_type,
      value,
      unit: mapping.unit,
      intensity: 5,
      workout_time: activity.start_date,
      source: 'strava',
      source_activity_id: String(object_id),
      ...stravaMetrics,
    };

    let workoutId: string | null = null;

    if (aspect_type === 'create') {
      const { data, error } = await supabase.from('workouts').insert(workoutData).select('id').single();
      if (error) console.error('Workout insert error:', error);
      else console.log('Workout inserted:', data?.id, mapping.category, value, mapping.unit);
      workoutId = data?.id ?? null;
    } else {
      const { data, error } = await supabase
        .from('workouts')
        .update({ value, workout_time: activity.start_date, ...stravaMetrics })
        .eq('user_id', integration.user_id)
        .eq('source', 'strava')
        .eq('source_activity_id', String(object_id))
        .select('id')
        .single();
      if (error) console.error('Workout update error:', error);
      else console.log('Workout updated:', data?.id);
      workoutId = data?.id ?? null;
    }

    return res.status(200).end();
  }
}
