import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { STRAVA_TYPE_MAP, generateStravaCard, getValidToken } from '../_strava-shared';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySuperAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('users').select('is_super_admin').eq('id', userId).single();
  return !!data?.is_super_admin;
}

// KST 날짜 문자열("YYYY-MM-DD")을 Unix timestamp로 변환 (KST = UTC+9)
function kstDateToUnix(dateStr: string, endOfDay: boolean): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (endOfDay) {
    // 해당일 23:59:59 KST
    return Math.floor(new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T23:59:59+09:00`).getTime() / 1000);
  } else {
    // 해당일 00:00:00 KST
    return Math.floor(new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00+09:00`).getTime() / 1000);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { caller_id, user_id, after_kst, before_kst } = req.body as {
    caller_id: string;
    user_id: string;
    after_kst: string;  // "YYYY-MM-DD"
    before_kst: string; // "YYYY-MM-DD"
  };

  if (!caller_id || !user_id || !after_kst || !before_kst) {
    return res.status(400).json({ error: 'caller_id, user_id, after_kst, before_kst required' });
  }
  if (!(await verifySuperAdmin(caller_id))) {
    return res.status(403).json({ error: 'Super admin only' });
  }

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('id, user_id, access_token, refresh_token, token_expires_at')
    .eq('user_id', user_id)
    .eq('provider', 'strava')
    .single();

  if (!integration) return res.status(404).json({ error: 'Strava integration not found for this user' });

  const accessToken = await getValidToken(supabase, integration);
  if (!accessToken) return res.status(500).json({ error: 'Token refresh failed' });

  const afterUnix = kstDateToUnix(after_kst, false);
  const beforeUnix = kstDateToUnix(before_kst, true);

  // Strava 활동 목록 조회 (최대 200개, 한 페이지로 충분)
  const activitiesRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${afterUnix}&before=${beforeUnix}&per_page=200&page=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!activitiesRes.ok) {
    const text = await activitiesRes.text();
    console.error('Strava activities fetch failed:', text);
    return res.status(500).json({ error: 'Strava API error', detail: text });
  }

  const summaryActivities: any[] = await activitiesRes.json();

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

    // 이미 등록된 활동인지 확인
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

    // 상세 활동 정보 조회 (device_name 등 포함)
    const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let activity = summary;
    if (detailRes.ok) {
      activity = await detailRes.json();
    }

    // 값 계산
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
      console.error('Insert failed:', activityId, error);
      failed++;
      results.push({ id: summary.id, name: summary.name, type: summary.type, date: summary.start_date, status: 'failed' });
      continue;
    }

    // 카드 생성
    const imageUrl = await generateStravaCard(activity, mapping, value, activityId);
    if (imageUrl && inserted?.id) {
      await supabase.from('workouts').update({ proof_image: imageUrl }).eq('id', inserted.id);
    }

    imported++;
    results.push({ id: summary.id, name: summary.name, type: summary.type, date: summary.start_date, status: 'imported' });
  }

  return res.status(200).json({
    total: summaryActivities.length,
    imported,
    skipped,
    failed,
    after_kst,
    before_kst,
    activities: results,
  });
}
