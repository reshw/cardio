import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  STRAVA_TYPE_MAP,
  generateStravaCard,
  getValidToken,
} from '../_strava-shared.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const accessToken = await getValidToken(supabase, integration);
    if (!accessToken) return res.status(200).end();

    const activityRes = await fetch(`https://www.strava.com/api/v3/activities/${object_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!activityRes.ok) {
      console.error('Strava activity fetch failed:', object_id, await activityRes.text());
      return res.status(200).end();
    }

    const activity = await activityRes.json();
    const mapping = STRAVA_TYPE_MAP[activity.type as string];
    if (!mapping) return res.status(200).end();

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
      calories: activity.calories != null ? Math.round(activity.calories) : null,
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
      workoutId = data?.id ?? null;
    }

    if (workoutId) {
      const imageUrl = await generateStravaCard(activity, mapping, value, String(object_id));
      if (imageUrl) {
        await supabase.from('workouts').update({ proof_image: imageUrl }).eq('id', workoutId);
      }
    }

    return res.status(200).end();
  }
}
