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

// 수신자(어드민 이메일)는 서버가 service_role 로 직접 조회한다.
// 클라이언트는 어드민 이메일을 읽을 수도, 수신자를 지정할 수도 없다.
// (docs/plans/rls-hardening.md §3-3)
export const sendClubRequestEmail = async (data: {
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
      const detail = await response.text().catch(() => '');
      console.error(`❌ 클럽 신청 이메일 발송 실패: HTTP ${response.status} ${detail}`);
      throw new Error(`이메일 발송 실패: HTTP ${response.status} ${detail}`);
    }
  } catch (error) {
    console.error('❌ 이메일 발송 오류 상세:', JSON.stringify(error), error);
  }
};
