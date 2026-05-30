import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Strava 운동 타입 → Cardio 카테고리 매핑
const STRAVA_TYPE_MAP: Record<string, { category: string; sub_type: string | null; unit: string } | null> = {
  Run:            { category: '달리기', sub_type: '러닝',     unit: 'km' },
  TrailRun:       { category: '달리기', sub_type: '러닝',     unit: 'km' },
  VirtualRun:     { category: '달리기', sub_type: '트레드밀', unit: 'km' },
  Ride:           { category: '사이클', sub_type: '실외',     unit: 'km' },
  VirtualRide:    { category: '사이클', sub_type: '실내',     unit: 'km' },
  MountainBikeRide: { category: '사이클', sub_type: '실외',   unit: 'km' },
  GravelRide:     { category: '사이클', sub_type: '실외',     unit: 'km' },
  Swim:           { category: '수영',   sub_type: null,       unit: 'm'  },
};

async function getValidToken(integration: {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}): Promise<string | null> {
  // 만료 1분 전까지는 기존 토큰 사용
  if (new Date(integration.token_expires_at) > new Date(Date.now() + 60_000)) {
    return integration.access_token;
  }

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
    console.error('Token refresh failed:', await res.text());
    return null;
  }

  const data = await res.json();

  await supabase
    .from('user_integrations')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET: Strava 웹훅 구독 등록 시 허브 챌린지 검증
  if (req.method === 'GET') {
    const { 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;

    if (verifyToken !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
      return res.status(403).json({ error: 'Invalid verify token' });
    }

    return res.status(200).json({ 'hub.challenge': challenge });
  }

  // POST: 활동 생성/수정/삭제 이벤트
  if (req.method === 'POST') {
    const { object_type, object_id, owner_id, aspect_type } = req.body as {
      object_type: string;
      object_id: number;
      owner_id: number;
      aspect_type: 'create' | 'update' | 'delete';
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
      await supabase
        .from('workouts')
        .delete()
        .eq('user_id', integration.user_id)
        .eq('source', 'strava')
        .eq('source_activity_id', String(object_id));
      return res.status(200).end();
    }

    if (aspect_type !== 'create' && aspect_type !== 'update') return res.status(200).end();

    const accessToken = await getValidToken(integration);
    if (!accessToken) return res.status(200).end();

    const activityRes = await fetch(
      `https://www.strava.com/api/v3/activities/${object_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!activityRes.ok) {
      console.error('Strava activity fetch failed:', object_id, await activityRes.text());
      return res.status(200).end();
    }

    const activity = await activityRes.json();
    const mapping = STRAVA_TYPE_MAP[activity.type as string];
    if (!mapping) return res.status(200).end();

    const value =
      mapping.unit === 'km'
        ? Math.round((activity.distance / 1000) * 100) / 100
        : Math.round(activity.distance);

    if (value <= 0) return res.status(200).end();

    const workoutData = {
      user_id: integration.user_id,
      category: mapping.category,
      sub_type: mapping.sub_type,
      value,
      unit: mapping.unit,
      intensity: 5,
      workout_time: activity.start_date_local,
      source: 'strava',
      source_activity_id: String(object_id),
    };

    if (aspect_type === 'create') {
      const { error } = await supabase.from('workouts').insert(workoutData);
      if (error) console.error('Workout insert error:', error);
    } else {
      const { error } = await supabase
        .from('workouts')
        .update({ value, workout_time: activity.start_date_local })
        .eq('user_id', integration.user_id)
        .eq('source', 'strava')
        .eq('source_activity_id', String(object_id));
      if (error) console.error('Workout update error:', error);
    }

    return res.status(200).end();
  }
}
