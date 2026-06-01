import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
// Card generation helpers
// ═══════════════════════════════════════════════════════════

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}'${ss}"`;
  }
  return `${m}'${ss}"`;
}

function formatPace(avgSpeedMs: number, unit: string): string | null {
  if (!avgSpeedMs || avgSpeedMs <= 0) return null;
  if (unit === 'km') {
    const sPerKm = 1000 / avgSpeedMs;
    const m = Math.floor(sPerKm / 60);
    const s = Math.round(sPerKm % 60);
    return `${m}'${String(s).padStart(2, '0')}"/km`;
  }
  if (unit === 'm') {
    const sPer100m = 100 / avgSpeedMs;
    const m = Math.floor(sPer100m / 60);
    const s = Math.round(sPer100m % 60);
    return `${m}'${String(s).padStart(2, '0')}"/100m`;
  }
  return null;
}

function formatDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

const CAT_EN: Record<string, string> = { '달리기': 'Run', '수영': 'Swim', '사이클': 'Cycle', '로잉': 'Row', '요가': 'Yoga', '헬스': 'Weights' };
const SUB_EN: Record<string, string> = {
  '러닝': 'Road', '트레드밀': 'Treadmill', '실내': 'Indoor', '실외': 'Outdoor',
  '풀수영': 'Pool', '오픈워터': 'Open Water', '전기자전거': 'E-Bike',
  '하타': 'Hatha', '아쉬탕가': 'Ashtanga', '빈야사': 'Vinyasa', '인요가': 'Yin',
};

function activityLabel(category: string, subType: string | null): string {
  const cat = CAT_EN[category] || category;
  const sub = subType ? (SUB_EN[subType] || subType) : null;
  return sub ? `${cat} · ${sub}` : cat;
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b = 0, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

function buildRouteData(encoded: string, aX: number, aY: number, aW: number, aH: number, pad = 30) {
  const coords = decodePolyline(encoded);
  if (coords.length < 2) return null;
  const lats = coords.map(c => c[0]), lngs = coords.map(c => c[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latR = maxLat - minLat || 0.001, lngR = maxLng - minLng || 0.001;
  const scale = Math.min((aW - pad * 2) / lngR, (aH - pad * 2) / latR);
  const offX = aX + pad + (aW - pad * 2 - lngR * scale) / 2;
  const offY = aY + pad + (aH - pad * 2 - latR * scale) / 2;
  const pts = coords.map(([la, ln]) => `${((ln - minLng) * scale + offX).toFixed(1)},${((maxLat - la) * scale + offY).toFixed(1)}`);
  const path = 'M ' + pts.join(' L ');
  const last = coords[coords.length - 1];
  return {
    path,
    endX: ((last[1] - minLng) * scale + offX),
    endY: ((maxLat - last[0]) * scale + offY),
  };
}

// Strava chevron logo path (24x24 viewBox, simpleicons)
const STRAVA_PATH = 'M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169';
const FONT = 'DejaVu Sans,Liberation Sans,Arial,sans-serif';

function buildRouteCardSvg(p: {
  label: string; value: string; unit: string;
  stats: { val: string; lbl: string }[];
  meta: string; polyline: string;
}): string {
  const route = buildRouteData(p.polyline, 490, 0, 310, 420, 30);
  const routeSvg = route ? `
    <path d="${xml(route.path)}" fill="none" stroke="#FC4C02" stroke-opacity="0.15" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${xml(route.path)}" fill="none" stroke="#FC4C02" stroke-opacity="0.7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${route.endX.toFixed(1)}" cy="${route.endY.toFixed(1)}" r="5" fill="#FC4C02" opacity="0.9"/>
    <circle cx="${route.endX.toFixed(1)}" cy="${route.endY.toFixed(1)}" r="9" fill="none" stroke="#FC4C02" stroke-width="1.5" opacity="0.4"/>
  ` : '';

  const statRows = p.stats.slice(0, 3).map((s, i) => {
    const vy = 262 + i * 38;
    return `<text x="54" y="${vy}" font-family="${FONT}" font-size="18" font-weight="bold" fill="#ffffff">${xml(s.val)}</text>
    <text x="54" y="${vy + 13}" font-family="${FONT}" font-size="9" fill="#444444">${xml(s.lbl)}</text>`;
  }).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#111111"/><stop offset="60%" stop-color="#1a0e08"/><stop offset="100%" stop-color="#0f0f0f"/>
    </linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#FC4C02"/><stop offset="100%" stop-color="#e03a00"/>
    </linearGradient>
    <linearGradient id="divl" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="50%" stop-color="#FC4C02" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="490" y1="0" x2="575" y2="0">
      <stop offset="0%" stop-color="#111111"/><stop offset="100%" stop-color="#111111" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="420" fill="url(#bg)"/>
  <rect x="0" y="0" width="6" height="420" fill="url(#side)"/>
  <text x="54" y="60" font-family="${FONT}" font-size="16" fill="#cccccc">${xml(p.label)}</text>
  <g transform="translate(54,71) scale(0.5)"><path d="${STRAVA_PATH}" fill="#FC4C02" opacity="0.55"/></g>
  <text x="70" y="82" font-family="${FONT}" font-size="11" fill="#555555">Recorded by Strava</text>
  <text x="54" y="210" font-family="${FONT}"><tspan font-size="96" font-weight="bold" fill="#ffffff" letter-spacing="-2">${xml(p.value)}</tspan><tspan font-size="26" fill="#666666" dy="-8" dx="8">${xml(p.unit)}</tspan></text>
  <rect x="54" y="233" width="380" height="1" fill="url(#divl)"/>
  ${statRows}
  <text x="54" y="387" font-family="${FONT}" font-size="11" font-weight="bold" fill="#2a2a2a" letter-spacing="2">CARDIO</text>
  <text x="54" y="402" font-family="${FONT}" font-size="11" fill="#333333">${xml(p.meta)}</text>
  ${routeSvg}
  <rect x="490" y="0" width="85" height="420" fill="url(#fade)"/>
</svg>`;
}

function buildNoRouteCardSvg(p: {
  label: string; value: string; unit: string;
  stats: { val: string; lbl: string }[];
  meta: string;
}): string {
  // Stats right-aligned; bottom baseline matches main number baseline (y=270)
  // 3 items × 50px apart: y=170, 220, 270
  const statRows = p.stats.slice(0, 3).map((s, i) => {
    const vy = 170 + i * 50;
    return `<text x="756" y="${vy}" font-family="${FONT}" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="end">${xml(s.val)}</text>
    <text x="756" y="${vy + 13}" font-family="${FONT}" font-size="10" fill="#444444" text-anchor="end">${xml(s.lbl)}</text>`;
  }).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#111111"/><stop offset="60%" stop-color="#1a0e08"/><stop offset="100%" stop-color="#0f0f0f"/>
    </linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#FC4C02"/><stop offset="100%" stop-color="#e03a00"/>
    </linearGradient>
    <linearGradient id="divl" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="40%" stop-color="#FC4C02" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="420" fill="url(#bg)"/>
  <rect x="0" y="0" width="6" height="420" fill="url(#side)"/>
  <circle cx="840" cy="480" r="110" fill="none" stroke="#FC4C02" stroke-opacity="0.08"/>
  <circle cx="810" cy="450" r="70" fill="none" stroke="#FC4C02" stroke-opacity="0.05"/>
  <text x="54" y="70" font-family="${FONT}" font-size="16" fill="#cccccc">${xml(p.label)}</text>
  <g transform="translate(624,58) scale(0.54)"><path d="${STRAVA_PATH}" fill="#FC4C02" opacity="0.55"/></g>
  <text x="756" y="70" font-family="${FONT}" font-size="12" fill="#555555" text-anchor="end">Recorded by Strava</text>
  <text x="54" y="270" font-family="${FONT}"><tspan font-size="108" font-weight="bold" fill="#ffffff" letter-spacing="-3">${xml(p.value)}</tspan><tspan font-size="28" fill="#666666" dy="-10" dx="10">${xml(p.unit)}</tspan></text>
  ${statRows}
  <rect x="54" y="305" width="702" height="1" fill="url(#divl)"/>
  <text x="54" y="368" font-family="${FONT}" font-size="12" font-weight="bold" fill="#2a2a2a" letter-spacing="2">CARDIO</text>
  <text x="756" y="368" font-family="${FONT}" font-size="12" fill="#3a3a3a" text-anchor="end">${xml(p.meta)}</text>
</svg>`;
}

async function generateStravaCard(
  activity: any,
  mapping: StravaMapping,
  value: number,
  activityId: string
): Promise<string | null> {
  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKey = process.env.R2_ACCESS_KEY_ID;
    const secretKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!accountId || !accessKey || !secretKey || !bucket || !publicUrl) {
      console.warn('R2 not configured, skipping card generation');
      return null;
    }

    const label = activityLabel(mapping.category, mapping.sub_type);
    const valueStr = String(value);
    const { unit } = mapping;
    const date = formatDate(activity.start_date);
    const device: string | null = activity.device_name ?? null;
    const meta = device ? `${date} · ${device}` : date;

    const stats: { val: string; lbl: string }[] = [];
    if (activity.moving_time) stats.push({ val: formatDuration(activity.moving_time), lbl: 'MOVING TIME' });
    const pace = (activity.average_speed && (unit === 'km' || unit === 'm'))
      ? formatPace(activity.average_speed, unit) : null;
    if (pace) stats.push({ val: pace, lbl: 'PACE' });
    if (activity.average_heartrate) stats.push({ val: `${Math.round(activity.average_heartrate)} bpm`, lbl: 'AVG HEARTRATE' });

    const polyline: string | null = activity.map?.summary_polyline ?? null;
    const hasRoute = !!(polyline && polyline.length > 10);

    const svg = hasRoute
      ? buildRouteCardSvg({ label, value: valueStr, unit, stats, meta, polyline: polyline! })
      : buildNoRouteCardSvg({ label, value: valueStr, unit, stats, meta });

    const webpBuf = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    const key = `strava-cards/${activityId}.webp`;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: webpBuf, ContentType: 'image/webp' }));
    return `${publicUrl}/${key}`;
  } catch (err) {
    console.error('Strava card generation failed:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// Token refresh
// ═══════════════════════════════════════════════════════════

async function refreshToken(integration: {
  id: string;
  refresh_token: string;
}): Promise<string | null> {
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
  if (new Date(integration.token_expires_at) > new Date(Date.now() + 60_000)) {
    return integration.access_token;
  }
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

    // Strava는 2초 내 응답 요구 — 먼저 200 반환 후 전체 처리를 백그라운드로
    res.status(200).end();

    (async () => {
      const activity = await fetchActivity(object_id, integration);
      if (!activity) return;
      const mapping = STRAVA_TYPE_MAP[activity.type as string];
      if (!mapping) return;

      let value: number;
      if (mapping.value_source === 'distance_km') value = Math.round((activity.distance / 1000) * 100) / 100;
      else if (mapping.value_source === 'distance_m') value = Math.round(activity.distance);
      else value = Math.round(activity.elapsed_time / 60);
      if (value <= 0) return;

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
        const wid = workoutId;
        generateStravaCard(activity, mapping, value, String(object_id))
          .then(async (imageUrl) => {
            if (imageUrl) {
              await supabase.from('workouts').update({ proof_image: imageUrl }).eq('id', wid);
            }
          })
          .catch(console.error);
      }
    })().catch(console.error);
  }
}
