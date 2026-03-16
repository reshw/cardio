// Cloudinary 이미지 업로드 유틸리티

export const uploadToCloudinary = async (file: File): Promise<string> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  console.log('🔧 Cloudinary 설정:', { cloudName, uploadPreset });

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary 설정이 없습니다. 환경 변수를 확인하세요.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log('📤 업로드 URL:', uploadUrl);

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    console.log('📥 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 업로드 실패 응답:', errorText);
      throw new Error(`이미지 업로드에 실패했습니다. (${response.status})`);
    }

    const data = await response.json();
    console.log('✅ 업로드 성공:', data);
    return data.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary 업로드 실패:', error);
    throw error;
  }
};
