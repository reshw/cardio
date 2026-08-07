export const sendMileageAlertEmail = async (data: {
  adminEmail: string;
  clubId: string;
  clubName: string;
  year: number;
  month: number;
  errorMessage: string;
}): Promise<void> => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'mileage-alert', ...data }),
    });
    if (!response.ok) console.error('❌ 마일리지 알림 이메일 발송 실패');
  } catch (error) {
    console.error('❌ 마일리지 알림 이메일 발송 오류:', error);
  }
};

export const sendTesterApplicationEmail = async (email: string): Promise<void> => {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tester-application', email, timestamp: new Date().toISOString() }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `요청 실패 (${response.status})`);
  }
};

export const sendClubRequestEmail = async (data: {
  adminEmail: string;
  clubName: string;
  clubDescription: string;
  creatorName: string;
}): Promise<void> => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'club-request', ...data }),
    });
    if (!response.ok) {
      console.error('❌ 이메일 발송 실패');
      throw new Error('이메일 발송에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 이메일 발송 오류:', error);
  }
};
