// Cloudflare R2 이미지 업로드 유틸리티

interface UploadResponse {
  success: boolean;
  originalUrl: string;
  thumbnailUrl: string;
}

// Vercel Functions payload 제한 대비 — 모바일 원본(5~15MB)을 1MB 이하로 줄여서 전송
const compressImageForUpload = (file: File): Promise<File> =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
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
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const out = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
            console.log(`🗜️ 압축: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(out.size / 1024 / 1024).toFixed(1)}MB`);
            resolve(out);
          } else {
            resolve(file);
          }
        },
        'image/webp',
        0.75,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

/**
 * R2에 이미지 업로드 (원본 + 썸네일)
 * @param file 업로드할 파일
 * @returns 원본 URL과 썸네일 URL
 */
export const uploadToR2 = async (file: File): Promise<string> => {
  file = await compressImageForUpload(file);
  console.log('📤 R2 업로드 시작:', file.name);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload-to-r2', {
      method: 'POST',
      body: formData,
    });

    console.log('📥 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 업로드 실패 응답:', errorText);
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
