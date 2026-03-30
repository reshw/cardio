import { Handler } from '@netlify/functions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

// 기본 설정값
const DEFAULT_SETTINGS = {
  max_width: 1280,
  quality: 75,
  thumbnail_size: 300,
};

// 이미지 설정 가져오기 (캐싱)
let cachedSettings: typeof DEFAULT_SETTINGS | null = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1분 캐시

async function getImageSettings() {
  const now = Date.now();

  // 캐시 유효하면 바로 반환
  if (cachedSettings && now - lastFetch < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'image_upload')
      .single();

    if (error || !data?.value) {
      console.log('⚙️ 기본 설정 사용');
      cachedSettings = DEFAULT_SETTINGS;
    } else {
      cachedSettings = data.value as typeof DEFAULT_SETTINGS;
      console.log('⚙️ DB 설정 로드:', cachedSettings);
    }

    lastFetch = now;
    return cachedSettings;
  } catch (error) {
    console.error('설정 로드 실패, 기본값 사용:', error);
    return DEFAULT_SETTINGS;
  }
}

// 파일 확장자 추출
const getFileExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext || 'jpg';
};

// Content-Type 결정
const getContentType = (ext: string): string => {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return types[ext] || 'image/jpeg';
};

export const handler: Handler = async (event) => {
  // 환경 변수 로드
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const BUCKET_NAME = process.env.R2_BUCKET_NAME;
  const PUBLIC_URL = process.env.R2_PUBLIC_URL;

  console.log('🔧 환경 변수 확인:', {
    hasAccountId: !!R2_ACCOUNT_ID,
    hasAccessKey: !!R2_ACCESS_KEY_ID,
    hasSecretKey: !!R2_SECRET_ACCESS_KEY,
    hasBucket: !!BUCKET_NAME,
    hasPublicUrl: !!PUBLIC_URL,
    bucketName: BUCKET_NAME,
  });

  // 환경 변수 필수 체크
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !BUCKET_NAME || !PUBLIC_URL) {
    console.error('❌ 환경 변수 누락!');
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Server configuration error',
        message: '환경 변수가 설정되지 않았습니다.',
      }),
    };
  }

  // 이미지 설정 로드
  const imageSettings = await getImageSettings();
  console.log('🎨 적용된 설정:', imageSettings);

  // R2 클라이언트 생성
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POST 요청만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // multipart/form-data 파싱
    const contentType = event.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
      };
    }

    // body를 base64 디코딩
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'utf-8');

    // boundary 추출
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No boundary found in Content-Type' }),
      };
    }

    // multipart 파싱 (간단한 버전)
    const parts = body.toString('binary').split(`--${boundary}`);
    let fileBuffer: Buffer | null = null;
    let filename = '';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const nameMatch = part.match(/name="([^"]+)"/);
        const filenameMatch = part.match(/filename="([^"]+)"/);

        if (nameMatch && nameMatch[1] === 'file' && filenameMatch) {
          filename = filenameMatch[1];

          // 헤더와 바디 분리
          const headerEndIndex = part.indexOf('\r\n\r\n');
          if (headerEndIndex !== -1) {
            const fileData = part.substring(headerEndIndex + 4);
            // 마지막 \r\n 제거
            const cleanData = fileData.substring(0, fileData.lastIndexOf('\r\n'));
            fileBuffer = Buffer.from(cleanData, 'binary');
          }
        }
      }
    }

    if (!fileBuffer || !filename) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file uploaded' }),
      };
    }

    console.log('📤 파일 업로드 시작:', filename);

    // 고유한 파일명 생성
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = getFileExtension(filename);
    const baseFilename = `${timestamp}-${randomStr}`;
    const originalKey = `${baseFilename}.${ext}`;
    const thumbnailKey = `${baseFilename}_thumb.${ext}`;

    // 원본 최적화 (설정값 사용)
    const optimizedBuffer = await sharp(fileBuffer)
      .resize(imageSettings.max_width, imageSettings.max_width, {
        fit: 'inside', // 비율 유지하며 내부에 맞춤
        withoutEnlargement: true, // 작은 이미지는 확대하지 않음
      })
      .webp({ quality: imageSettings.quality }) // WebP 압축
      .toBuffer();

    console.log(`📦 압축 완료: ${fileBuffer.length} → ${optimizedBuffer.length} bytes (${Math.round((1 - optimizedBuffer.length / fileBuffer.length) * 100)}% 절감)`);

    // 최적화된 원본 업로드
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: originalKey.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp'), // 확장자 webp로 변경
        Body: optimizedBuffer,
        ContentType: 'image/webp', // WebP로 통일
      })
    );

    console.log('✅ 원본 업로드 완료:', originalKey);

    // 썸네일 생성 (설정값 사용)
    const thumbnailBuffer = await sharp(fileBuffer)
      .resize(imageSettings.thumbnail_size, imageSettings.thumbnail_size, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: imageSettings.quality })
      .toBuffer();

    // 썸네일 업로드
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: thumbnailKey.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp'), // 확장자 webp로 변경
        Body: thumbnailBuffer,
        ContentType: 'image/webp', // WebP로 통일
      })
    );

    console.log('✅ 썸네일 업로드 완료:', thumbnailKey);

    // Public URL 생성 (확장자 .webp로)
    const originalUrl = `${PUBLIC_URL}/${originalKey.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp')}`;
    const thumbnailUrl = `${PUBLIC_URL}/${thumbnailKey.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp')}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        originalUrl,
        thumbnailUrl,
      }),
    };
  } catch (error) {
    console.error('❌ 업로드 실패:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
