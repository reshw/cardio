import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  FONTS_DIR, xml, formatDuration, formatPace, formatDateKST, activityLabel,
  type GeoJsonLineString,
} from './_strava-shared.js';

const SOURCE_COLOR: Record<string, string> = {
  strava: '#FC4C02',
  google_health: '#4285F4',
  apple_health: '#FF2D55',
};

const SOURCE_LABEL: Record<string, string> = {
  strava: 'Strava',
  google_health: 'Google Health Connect',
  apple_health: 'Apple Health',
};

const FONT = 'Black Han Sans';

function perpendicularDistance(
  pt: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(pt[0] - a[0], pt[1] - a[1]);
  const t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy));
}

function douglasPeucker(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    return [
      ...douglasPeucker(pts.slice(0, idx + 1), eps),
      ...douglasPeucker(pts.slice(idx), eps).slice(1),
    ];
  }
  return [pts[0], pts[pts.length - 1]];
}

function downsample(pts: [number, number][], targetMax = 300): [number, number][] {
  if (pts.length <= targetMax) return pts;
  let eps = 0.00005;
  let result = pts;
  while (result.length > targetMax && eps < 0.1) {
    result = douglasPeucker(pts, eps);
    eps *= 2;
  }
  return result;
}

function buildRouteFromGeoJson(
  geo: GeoJsonLineString,
  aX: number, aY: number, aW: number, aH: number, pad = 30
) {
  const rawPts: [number, number][] = geo.coordinates.map(c => [c[0], c[1]]);
  const pts = downsample(rawPts);
  if (pts.length < 2) return null;

  const lngs = pts.map(p => p[0]);
  const lats = pts.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latR = maxLat - minLat || 0.001;
  const lngR = maxLng - minLng || 0.001;
  const scale = Math.min((aW - pad * 2) / lngR, (aH - pad * 2) / latR);
  const offX = aX + pad + (aW - pad * 2 - lngR * scale) / 2;
  const offY = aY + pad + (aH - pad * 2 - latR * scale) / 2;
  const svgPts = pts.map(([lon, lat]) =>
    `${((lon - minLng) * scale + offX).toFixed(1)},${((maxLat - lat) * scale + offY).toFixed(1)}`
  );
  const last = pts[pts.length - 1];
  return {
    path: 'M ' + svgPts.join(' L '),
    endX: (last[0] - minLng) * scale + offX,
    endY: (maxLat - last[1]) * scale + offY,
  };
}

function buildCardSvg(p: {
  label: string;
  value: string;
  unit: string;
  stats: { val: string; lbl: string }[];
  meta: string;
  source: string;
  route?: GeoJsonLineString | null;
}): string {
  const color = SOURCE_COLOR[p.source] ?? '#4285F4';
  const sourceLabel = SOURCE_LABEL[p.source] ?? p.source;

  if (p.route && p.route.coordinates.length > 1) {
    const routeData = buildRouteFromGeoJson(p.route, 370, 0, 230, 600, 30);
    const routeSvg = routeData ? `
    <path d="${xml(routeData.path)}" fill="none" stroke="${color}" stroke-opacity="0.15" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${xml(routeData.path)}" fill="none" stroke="${color}" stroke-opacity="0.7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${routeData.endX.toFixed(1)}" cy="${routeData.endY.toFixed(1)}" r="5" fill="${color}" opacity="0.9"/>
    <circle cx="${routeData.endX.toFixed(1)}" cy="${routeData.endY.toFixed(1)}" r="9" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>` : '';

    const statRows = p.stats.slice(0, 3).map((s, i) => {
      const vy = 300 + i * 58;
      return `<text x="42" y="${vy}" font-family="${FONT}" font-size="30" font-weight="bold" fill="#ffffff">${xml(s.val)}</text>
    <text x="42" y="${vy + 16}" font-family="${FONT}" font-size="9" fill="#444444">${xml(s.lbl)}</text>`;
    }).join('\n    ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#111111"/><stop offset="60%" stop-color="#0d0d15"/><stop offset="100%" stop-color="#0f0f0f"/>
    </linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}cc"/>
    </linearGradient>
    <linearGradient id="divl" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="50%" stop-color="${color}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="370" y1="0" x2="440" y2="0">
      <stop offset="0%" stop-color="#111111"/><stop offset="100%" stop-color="#111111" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <rect x="0" y="0" width="6" height="600" fill="url(#side)"/>
  <text x="42" y="65" font-family="${FONT}" font-size="15" fill="#cccccc">${xml(p.label)}</text>
  <text x="42" y="83" font-family="${FONT}" font-size="10" fill="#555555">${xml(sourceLabel)}</text>
  <text x="42" y="235" font-family="${FONT}"><tspan font-size="104" font-weight="bold" fill="#ffffff" letter-spacing="-4">${xml(p.value)}</tspan><tspan font-size="28" fill="#666666" dy="-8" dx="8">${xml(p.unit)}</tspan></text>
  <rect x="42" y="250" width="280" height="1" fill="url(#divl)"/>
  ${statRows}
  <text x="42" y="548" font-family="${FONT}" font-size="10" font-weight="bold" fill="#2a2a2a" letter-spacing="2">CARDIO</text>
  <text x="42" y="563" font-family="${FONT}" font-size="10" fill="#333333">${xml(p.meta)}</text>
  ${routeSvg}
  <rect x="370" y="0" width="70" height="600" fill="url(#fade)"/>
</svg>`;
  }

  // No-route layout
  const colX = [42, 233, 405];
  const statCols = p.stats.slice(0, 3).map((s, i) => {
    const vx = colX[i];
    return `<text x="${vx}" y="431" font-family="${FONT}" font-size="30" font-weight="bold" fill="#ffffff">${xml(s.val)}</text>
    <text x="${vx}" y="448" font-family="${FONT}" font-size="10" fill="#444444">${xml(s.lbl)}</text>`;
  }).join('\n    ');

  const sep1 = p.stats.length >= 2 ? `<rect x="213" y="401" width="1" height="56" fill="#ffffff" fill-opacity="0.05"/>` : '';
  const sep2 = p.stats.length >= 3 ? `<rect x="385" y="401" width="1" height="56" fill="#ffffff" fill-opacity="0.05"/>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#111111"/><stop offset="60%" stop-color="#0d0d15"/><stop offset="100%" stop-color="#0f0f0f"/>
    </linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}cc"/>
    </linearGradient>
    <linearGradient id="divl" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="40%" stop-color="${color}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <rect x="0" y="0" width="6" height="600" fill="url(#side)"/>
  <circle cx="540" cy="540" r="130" fill="none" stroke="${color}" stroke-opacity="0.08"/>
  <circle cx="553" cy="553" r="82" fill="none" stroke="${color}" stroke-opacity="0.05"/>
  <text x="42" y="68" font-family="${FONT}" font-size="16" fill="#cccccc">${xml(p.label)}</text>
  <text x="554" y="68" font-family="${FONT}" font-size="11" fill="#555555" text-anchor="end">${xml(sourceLabel)}</text>
  <text x="42" y="274" font-family="${FONT}"><tspan font-size="140" font-weight="bold" fill="#ffffff" letter-spacing="-6">${xml(p.value)}</tspan><tspan font-size="34" fill="#666666" dy="-12" dx="10">${xml(p.unit)}</tspan></text>
  <rect x="42" y="386" width="512" height="1" fill="url(#divl)"/>
  ${sep1}
  ${sep2}
  ${statCols}
  <text x="42" y="556" font-family="${FONT}" font-size="11" font-weight="bold" fill="#2a2a2a" letter-spacing="2">CARDIO</text>
  <text x="554" y="556" font-family="${FONT}" font-size="11" fill="#3a3a3a" text-anchor="end">${xml(p.meta)}</text>
</svg>`;
}

export interface WorkoutRow {
  id: string;
  source: string;
  category: string;
  sub_type?: string | null;
  workout_time: string;
  elapsed_seconds?: number | null;
  moving_seconds?: number | null;
  value?: number | null;
  unit?: string | null;
  average_speed?: number | null;
  average_heartrate?: number | null;
  steps?: number | null;
  elevation_gain?: number | null;
  calories?: number | null;
  device_name?: string | null;
  route?: GeoJsonLineString | null;
}

export async function generateWorkoutCard(row: WorkoutRow): Promise<string | null> {
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

    const label = activityLabel(row.category, row.sub_type ?? null);
    const elapsed = row.elapsed_seconds ?? 0;
    const moving = row.moving_seconds ?? elapsed;
    const unit = row.unit ?? 'km';
    const cat = row.category;

    let distanceM: number | null = null;
    if (unit === 'km' && row.value) distanceM = row.value * 1000;
    else if (unit === 'm' && row.value) distanceM = row.value;

    let displayValue: string;
    let displayUnit: string;
    if (unit === '분') {
      const mins = row.value ?? Math.round(elapsed / 60);
      if (!mins) return null;
      displayValue = String(mins);
      displayUnit = 'min';
    } else if (row.value != null && row.value > 0) {
      displayValue = String(row.value);
      displayUnit = unit === 'm' ? 'm' : 'km';
    } else {
      return null;
    }

    let avgSpeed = row.average_speed ?? null;
    if (!avgSpeed && distanceM && moving > 0) {
      avgSpeed = distanceM / moving;
    }

    const stats: { val: string; lbl: string }[] = [];

    if (unit !== '분' && moving > 0) {
      stats.push({ val: formatDuration(moving), lbl: 'MOVING TIME' });
    }

    if (cat === '달리기') {
      const pace = avgSpeed ? formatPace(avgSpeed, 'km') : null;
      if (pace) stats.push({ val: pace, lbl: 'PACE' });
    } else if (cat === '걷기') {
      if (row.steps) {
        stats.push({ val: row.steps.toLocaleString(), lbl: 'STEPS' });
      } else {
        const pace = avgSpeed ? formatPace(avgSpeed, 'km') : null;
        if (pace) stats.push({ val: pace, lbl: 'PACE' });
      }
    } else if (cat === '사이클' || cat === '로잉') {
      if (avgSpeed) stats.push({ val: `${(avgSpeed * 3.6).toFixed(1)} km/h`, lbl: 'AVG SPEED' });
    } else if (cat === '수영') {
      const pace = avgSpeed ? formatPace(avgSpeed, 'm') : null;
      if (pace) stats.push({ val: pace, lbl: 'PACE' });
    } else if (cat === '등산' || cat === '하이킹') {
      if (row.elevation_gain) stats.push({ val: `${Math.round(row.elevation_gain)} m`, lbl: 'ELEVATION' });
    }

    if (stats.length < 3 && row.average_heartrate) {
      stats.push({ val: `${Math.round(row.average_heartrate)} bpm`, lbl: 'AVG HEARTRATE' });
    }
    if (stats.length < 3 && row.calories) {
      stats.push({ val: `${Math.round(row.calories)} kcal`, lbl: 'CALORIES' });
    }

    const date = formatDateKST(row.workout_time);
    const meta = row.device_name ? `${date} · ${row.device_name}` : date;

    const svg = buildCardSvg({
      label, value: displayValue, unit: displayUnit,
      stats: stats.slice(0, 3), meta,
      source: row.source,
      route: row.route ?? null,
    });

    const { Resvg } = await import('@resvg/resvg-js');
    const fontOpts = { fontDirs: [FONTS_DIR], loadSystemFonts: false };
    const pngBuffer = new Resvg(svg, { fitTo: { mode: 'width' as const, value: 600 }, font: fontOpts }).render().asPng();
    const thumbBuffer = new Resvg(svg, { fitTo: { mode: 'width' as const, value: 300 }, font: fontOpts }).render().asPng();

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    const key = `workout-cards/${row.id}.png`;
    const thumbKey = `workout-cards/${row.id}_thumb.png`;
    await Promise.all([
      s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: pngBuffer, ContentType: 'image/png' })),
      s3.send(new PutObjectCommand({ Bucket: bucket, Key: thumbKey, Body: thumbBuffer, ContentType: 'image/png' })),
    ]);
    return `${publicUrl}/${key}`;
  } catch (err) {
    console.error('Workout card generation failed:', err);
    return null;
  }
}
