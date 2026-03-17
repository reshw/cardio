// Netlify Function을 통한 이메일 발송

export const sendClubRequestEmail = async (data: {
  adminEmail: string;
  clubName: string;
  clubDescription: string;
  creatorName: string;
}): Promise<void> => {
  try {
    const response = await fetch('/.netlify/functions/send-club-request-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ 이메일 발송 실패:', error);
      throw new Error('이메일 발송에 실패했습니다.');
    }

    console.log('✅ 이메일 발송 성공');
  } catch (error) {
    console.error('❌ 이메일 발송 오류:', error);
    // 이메일 발송 실패해도 클럽 생성은 진행되도록 에러를 throw하지 않음
  }
};
