// Cloudflare R2 이미지 업로드 유틸리티

interface UploadResponse {
  success: boolean;
  originalUrl: string;
  thumbnailUrl: string;
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

// Vercel Functions payload 제한 대비 — 모바일 원본(5~15MB)을 1MB 이하로 줄여서 전송
const compressImageForUpload = async (file: File): Promise<File> => {
  const orientation = await getExifOrientation(file);

  return new Promise((resolve) => {
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

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const out = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
            console.log(`🗜️ 압축: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(out.size / 1024 / 1024).toFixed(1)}MB (orientation: ${orientation})`);
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
};

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
