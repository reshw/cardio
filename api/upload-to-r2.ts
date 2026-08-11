import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage } from 'http';

// bodyParser 비활성화 — multipart/form-data를 raw buffer로 직접 처리
export const config = { api: { bodyParser: false } };

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

const DEFAULT_SETTINGS = { max_width: 1280, quality: 75, thumbnail_size: 300 };

// 업로드 목적별 프로필 키 — src/utils/r2Storage.ts IMAGE_SETTINGS_KEY 와 동일하게 유지할 것
const ALLOWED_SETTINGS_KEYS = ['image_upload', 'image_upload_event'];

const settingsCache = new Map<string, { value: typeof DEFAULT_SETTINGS; fetchedAt: number }>();
const CACHE_TTL = 60000;

async function getImageSettings(key: string) {
  const now = Date.now();
  const cached = settingsCache.get(key);
  if (cached && now - cached.fetchedAt < CACHE_TTL) return cached.value;

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    const value = (!error && data?.value) ? data.value as typeof DEFAULT_SETTINGS : DEFAULT_SETTINGS;
    settingsCache.set(key, { value, fetchedAt: now });
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || 'jpg';
}

async function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const BUCKET_NAME = process.env.R2_BUCKET_NAME;
  const PUBLIC_URL = process.env.R2_PUBLIC_URL;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !BUCKET_NAME || !PUBLIC_URL) {
    console.error('❌ 환경 변수 누락!');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  try {
    const contentType = (req.headers['content-type'] as string) || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    const body = await getRawBody(req);

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'No boundary found in Content-Type' });
    }

    const parts = body.toString('binary').split(`--${boundary}`);
    let fileBuffer: Buffer | null = null;
    let filename = '';
    let settingsKey = 'image_upload';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const nameMatch = part.match(/name="([^"]+)"/);
        const filenameMatch = part.match(/filename="([^"]+)"/);

        if (nameMatch && nameMatch[1] === 'file' && filenameMatch) {
          filename = filenameMatch[1];
          const headerEndIndex = part.indexOf('\r\n\r\n');
          if (headerEndIndex !== -1) {
            const fileData = part.substring(headerEndIndex + 4);
            const cleanData = fileData.substring(0, fileData.lastIndexOf('\r\n'));
            fileBuffer = Buffer.from(cleanData, 'binary');
          }
        } else if (nameMatch && nameMatch[1] === 'settingsKey' && !filenameMatch) {
          const headerEndIndex = part.indexOf('\r\n\r\n');
          if (headerEndIndex !== -1) {
            const raw = part.substring(headerEndIndex + 4);
            const value = raw.substring(0, raw.lastIndexOf('\r\n')).trim();
            if (ALLOWED_SETTINGS_KEYS.includes(value)) settingsKey = value;
          }
        }
      }
    }

    if (!fileBuffer || !filename) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📤 파일 업로드 시작:', filename, `(settingsKey=${settingsKey})`);
    const imageSettings = await getImageSettings(settingsKey);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = getFileExtension(filename);
    const baseFilename = `${timestamp}-${randomStr}`;
    const originalKey = `${baseFilename}.${ext}`;
    const thumbnailKey = `${baseFilename}_thumb.${ext}`;

    const optimizedBuffer = await sharp(fileBuffer)
      .rotate()
      .resize(imageSettings.max_width, imageSettings.max_width, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: imageSettings.quality })
      .toBuffer();

    const webpOriginalKey = originalKey.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
    const webpThumbnailKey = thumbnailKey.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: webpOriginalKey,
      Body: optimizedBuffer,
      ContentType: 'image/webp',
    }));

    const thumbnailBuffer = await sharp(fileBuffer)
      .rotate()
      .resize(imageSettings.thumbnail_size, imageSettings.thumbnail_size, { fit: 'cover', position: 'center' })
      .webp({ quality: imageSettings.quality })
      .toBuffer();

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: webpThumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/webp',
    }));

    return res.status(200).json({
      success: true,
      originalUrl: `${PUBLIC_URL}/${webpOriginalKey}`,
      thumbnailUrl: `${PUBLIC_URL}/${webpThumbnailKey}`,
    });
  } catch (error) {
    console.error('❌ 업로드 실패:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
