import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { STRAVA_TYPE_MAP, getValidToken } from '../_strava-shared';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('users').select('is_super_admin').eq('id', userId).single();
  return !!data?.is_super_admin;
}

function kstDateToUnix(dateStr: string, endOfDay: boolean): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (endOfDay) {
    return Math.floor(new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T23:59:59+09:00`).getTime() / 1000);
  } else {
    return Math.floor(new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00+09:00`).getTime() / 1000);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { caller_id, user_id, after_kst, before_kst } = req.body as {
      caller_id: string;
      user_id: string;
      after_kst: string;
      before_kst: string;
    };

    console.log('[backfill] start', { caller_id, user_id, after_kst, before_kst });

    if (!caller_id || !user_id || !after_kst || !before_kst) {
      return res.status(400).json({ error: 'caller_id, user_id, after_kst, before_kst required' });
    }
    if (!(await verifySuperAdmin(caller_id))) {
      return res.status(403).json({ error: 'Super admin only' });
    }

    console.log('[backfill] admin verified');

    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('id, user_id, access_token, refresh_token, token_expires_at')
      .eq('user_id', user_id)
      .eq('provider', 'strava')
      .single();

    if (integrationError) {
      console.error('[backfill] integration fetch error:', integrationError);
      return res.status(500).json({ error: 'DB error', detail: integrationError.message });
    }
    if (!integration) {
      return res.status(404).json({ error: 'Strava integration not found for this user' });
    }

    console.log('[backfill] integration found, token_expires_at:', integration.token_expires_at);

    const accessToken = await getValidToken(supabase, integration);
    if (!accessToken) {
      console.error('[backfill] token refresh failed');
      return res.status(500).json({ error: 'Token refresh failed' });
    }

    console.log('[backfill] token ok');

    const afterUnix = kstDateToUnix(after_kst, false);
    const beforeUnix = kstDateToUnix(before_kst, true);

    console.log('[backfill] fetching activities', { afterUnix, beforeUnix });

    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${afterUnix}&before=${beforeUnix}&per_page=200&page=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!activitiesRes.ok) {
      const text = await activitiesRes.text();
      console.error('[backfill] Strava activities fetch failed:', activitiesRes.status, text);
      return res.status(500).json({ error: 'Strava API error', detail: text });
    }

    const summaryActivities: any[] = await activitiesRes.json();
    console.log('[backfill] activities count:', summaryActivities.length);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const results: { id: number; name: string; type: string; date: string; status: string }[] = [];

    for (const summary of summaryActivities) {
      const activityId = String(summary.id);
      const mapping = STRAVA_TYPE_MAP[summary.type as string];

      if (!mapping) {
        skipped++;
        results.push({ id: summary.id, name: summary.name, type: summary.type, date: summary.start_date, status: 'skipped(unsupported_type)' });
        continue;
      }

      const { data: existing } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user_id)
        .eq('source', 'strava')
        .eq('source_activity_id', activityId)
        .maybeSingle();

      if (existing) {
        skipped++;
        results.push({ id: summary.id, name: summary.name, type: summary.type, date: summary.start_date, status: 'skipped(already_exists)' });
        continue;
      }

      const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let activity = summary;
      if (detailRes.ok) {
        activity = await detailRes.json();
      } else {
        console.warn('[backfill] detail fetch failed for', activityId, detailRes.status);
      }

      let value: number;
      if (mapping.value_source === 'distance_km') value = Math.round((activity.distance / 1000) * 100) / 100;
      else if (mapping.value_source === 'distance_m') value = Math.round(activity.distance);
      else value = Math.round(activity.elapsed_time / 60);

      if (value <= 0) {
        skipped++;
        results.push({ id: summary.id, name: summary.name, type: summary.type, date: summary.start_date, status: 'skipped(zero_value)' });
        continue;
      }

      const workoutData = {
        user_id,
        category: mapping.category,
        sub_type: mapping.sub_type,
        value,
        unit: mapping.unit,
        intensity: 5,
        workout_time: activity.start_date,
        source: 'strava',
        source_activity_id: activityId,
        elapsed_seconds: activity.elapsed_time ?? null,
        moving_seconds: activity.moving_time ?? null,
        average_speed: activity.average_speed ?? null,
        average_heartrate: activity.average_heartrate ?? null,
        device_name: activity.device_name ?? null,
        timezone: activity.timezone ?? null,
        utc_offset: activity.utc_offset != null ? Math.round(activity.utc_offset) : null,
      };

      const { data: inserted, error } = await supabase
        .from('workouts')
        .insert(workoutData)
        .select('id')
        .single();

      if (error) {
        console.error('[backfill] insert failed:', activityId, error.message, error.details);
        failed++;
        results.push({ id: summary.id, name: summary.name, type: summary.type, date: summary.start_date, status: `failed(${error.message})` });
        continue;
      }

      console.log('[backfill] inserted:', activityId, '→ workout', inserted?.id);
      imported++;
      results.push({ id: summary.id, name: summary.name, type: summary.type, date: summary.start_date, status: 'imported' });
    }

    console.log('[backfill] done', { imported, skipped, failed });

    return res.status(200).json({
      total: summaryActivities.length,
      imported,
      skipped,
      failed,
      after_kst,
      before_kst,
      activities: results,
    });

  } catch (err: any) {
    console.error('[backfill] unexpected error:', err?.message, err?.stack);
    return res.status(500).json({ error: 'Unexpected error', detail: err?.message ?? String(err) });
  }
}
