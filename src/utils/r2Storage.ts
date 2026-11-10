// Cloudflare R2 이미지 업로드 유틸리티
import { supabase } from '../lib/supabase';

interface UploadResponse {
  success: boolean;
  originalUrl: string;
  thumbnailUrl: string;
}

/**
 * 업로드 목적별 이미지 설정 프로필. 슈퍼관리자 화면(AdminImageSettings)에서
 * system_settings 테이블에 프로필별로 따로 저장/조정한다 (더보기 > 이미지 업로드 설정).
 * - proof: 운동 기록 인증사진 (기존)
 * - event: 행사 기록사진 — 인증용이 아니라 더 고화질을 허용해도 되는 용도
 */
export type ImageUploadProfile = 'proof' | 'event';

interface ImageUploadSettings {
  max_width: number;
  quality: number;
  thumbnail_size: number;
}

export const IMAGE_SETTINGS_KEY: Record<ImageUploadProfile, string> = {
  proof: 'image_upload',
  event: 'image_upload_event',
};

const DEFAULT_IMAGE_SETTINGS: ImageUploadSettings = { max_width: 1280, quality: 75, thumbnail_size: 300 };

async function getImageSettings(profile: ImageUploadProfile): Promise<ImageUploadSettings> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', IMAGE_SETTINGS_KEY[profile])
      .single();
    if (error || !data?.value) return DEFAULT_IMAGE_SETTINGS;
    return data.value as ImageUploadSettings;
  } catch {
    return DEFAULT_IMAGE_SETTINGS;
  }
}

// JPEG EXIF orientation 읽기 (canvas.drawImage는 EXIF를 무시하므로 직접 파싱)
function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target!.result as ArrayBuffer);
        if (view.getUint16(0, false) !== 0xFFD8) { resolve(1); return; }
        let offset = 2;
        while (offset < view.byteLength) {
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xFFE1) {
            if (view.getUint32(offset + 2, false) !== 0x45786966) { resolve(1); return; }
            const little = view.getUint16(offset + 8, false) === 0x4949;
            const ifdOffset = view.getUint32(offset + 14, little);
            const entries = view.getUint16(offset + 8 + ifdOffset, little);
            for (let i = 0; i < entries; i++) {
              const entryOffset = offset + 8 + ifdOffset + 2 + i * 12;
              if (view.getUint16(entryOffset, little) === 0x0112) {
                resolve(view.getUint16(entryOffset + 8, little));
                return;
              }
            }
            resolve(1); return;
          }
          if ((marker & 0xFF00) !== 0xFF00) break;
          offset += view.getUint16(offset, false);
        }
      } catch { /* ignore */ }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

// Vercel Functions payload 제한 대비 — 모바일 원본(5~15MB)을 전송 전에 줄인다.
// maxWidth/quality는 프로필별 system_settings 값을 그대로 따른다 — 여기서 하드코딩해
// 서버(sharp) 설정을 올려도 클라이언트가 먼저 눌러버리면 무의미해진다.
const compressImageForUpload = async (file: File, maxWidth: number, quality: number): Promise<File> => {
  const orientation = await getExifOrientation(file);

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = maxWidth;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }

      // orientation 5~8은 90/270도 회전 → canvas 가로세로 뒤집기
      const swap = orientation >= 5 && orientation <= 8;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? height : width;
      canvas.height = swap ? width : height;

      const ctx = canvas.getContext('2d')!;
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, canvas.width, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, canvas.width, canvas.height); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, canvas.height); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, canvas.height, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, canvas.height, canvas.width); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, canvas.width); break;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // 서버(api/upload-to-r2)가 어차피 sharp로 webp 재인코딩하므로 클라이언트
      // 출력 포맷은 "업로드 전 용량을 확실히 줄이는" 역할만 하면 된다. webp는
      // iOS WKWebView(Safari 엔진)에서 canvas.toBlob 인코딩 지원이 불안정해서
      // 디코딩 실패 시 무압축 PNG로 폴백 → 오히려 용량이 커져 413(Payload Too
      // Large)이 났다. jpeg는 모든 브라우저/WebView에서 인코딩이 보장된다.
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const out = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
            console.log(`🗜️ 압축: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(out.size / 1024 / 1024).toFixed(1)}MB (orientation: ${orientation})`);
            resolve(out.size > 0 && out.size < file.size ? out : file);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality / 100,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

/**
 * R2에 이미지 업로드 (원본 + 썸네일)
 * @param file 업로드할 파일
 * @param profile 어떤 system_settings 프로필(크기/화질)을 적용할지 — 기본은 기존 인증사진 설정
 * @returns 원본 URL과 썸네일 URL
 */
export const uploadToR2 = async (file: File, profile: ImageUploadProfile = 'proof'): Promise<string> => {
  const settings = await getImageSettings(profile);
  file = await compressImageForUpload(file, settings.max_width, settings.quality);
  console.log('📤 R2 업로드 시작:', file.name, `(profile=${profile})`);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('settingsKey', IMAGE_SETTINGS_KEY[profile]);

  try {
    const response = await fetch('/api/upload-to-r2', {
      method: 'POST',
      body: formData,
    });

    console.log('📥 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 업로드 실패 응답:', errorText);
      if (response.status === 413) {
        throw new Error('이미지 용량이 너무 큽니다. 압축 후에도 서버 업로드 한도를 넘었습니다 — 다른 사진으로 시도해주세요. (413)');
      }
      throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
    }

    const data: UploadResponse = await response.json();
    console.log('✅ 업로드 성공:', data);

    // 원본 URL 반환 (기존 Cloudinary와 호환성 유지)
    return data.originalUrl;
  } catch (error) {
    console.error('❌ R2 업로드 실패:', error);
    throw error;
  }
};

/**
 * R2 이미지 URL을 썸네일 URL로 변환
 * @param url 원본 이미지 URL
 * @returns 썸네일 URL
 */
export const getR2Thumbnail = (url: string): string => {
  if (!url) return url;

  // R2 URL인 경우 썸네일로 변환
  // 예: image.jpg -> image_thumb.jpg
  const lastDotIndex = url.lastIndexOf('.');
  if (lastDotIndex === -1) return url;

  const baseName = url.substring(0, lastDotIndex);
  const extension = url.substring(lastDotIndex);

  return `${baseName}_thumb${extension}`;
};

/**
 * 이미지 URL을 썸네일로 변환 (Cloudinary + R2 통합)
 * @param url 이미지 URL
 * @param width 썸네일 너비 (R2에서는 무시됨, 300px 고정)
 * @param height 썸네일 높이 (R2에서는 무시됨, 300px 고정)
 * @returns 썸네일 URL
 */
export const getThumbnail = (url: string, width?: number, height?: number): string => {
  if (!url) return url;

  // Cloudinary URL인 경우
  if (url.includes('cloudinary.com')) {
    const w = width || 300;
    const h = height || 300;
    return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill/`);
  }

  // R2 URL인 경우
  return getR2Thumbnail(url);
};
