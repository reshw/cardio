import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 서버용 키 필요
);

// 매월 1일 00:00 (UTC) 실행 - 전월 스냅샷 저장
const handler = schedule('0 0 1 * *', async () => {
  console.log('🔄 월별 마일리지 스냅샷 배치 시작');

  try {
    const now = new Date();
    // 전월 계산
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;

    console.log(`📅 스냅샷 생성: ${year}년 ${month}월`);

    // 모든 클럽 조회
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('id, mileage_config');

    if (clubsError) {
      console.error('❌ 클럽 조회 실패:', clubsError);
      throw clubsError;
    }

    if (!clubs || clubs.length === 0) {
      console.log('ℹ️  클럽이 없습니다');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No clubs to process' }),
      };
    }

    console.log(`📊 클럽 수: ${clubs.length}`);

    // 각 클럽별로 스냅샷 생성
    const snapshots = clubs.map((club) => ({
      club_id: club.id,
      year,
      month,
      mileage_config: club.mileage_config || {
        '달리기-트레드밀': 1,
        '달리기-러닝': 1,
        '사이클-실외': 3,
        '사이클-실내': 5,
        '수영': 200,
        '계단': 20,
      },
    }));

    // 일괄 삽입 (upsert)
    const { data, error } = await supabase
      .from('club_monthly_configs')
      .upsert(snapshots, { onConflict: 'club_id,year,month' });

    if (error) {
      console.error('❌ 스냅샷 저장 실패:', error);
      throw error;
    }

    console.log(`✅ 스냅샷 저장 완료: ${clubs.length}개 클럽`);

    // 루키리그 졸업 체크: 전월 기준으로 100점 달성한 멤버 졸업 처리
    const { data: graduatedCount, error: rookieError } = await supabase
      .rpc('update_rookie_graduations');

    if (rookieError) {
      console.error('❌ 루키 졸업 처리 실패:', rookieError);
    } else {
      console.log(`🎓 루키 졸업 처리 완료: ${graduatedCount}명`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Monthly snapshots created successfully',
        year,
        month,
        clubCount: clubs.length,
        rookieGraduated: graduatedCount ?? 0,
      }),
    };
  } catch (error) {
    console.error('❌ 배치 실패:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Batch job failed', details: error }),
    };
  }
});

export { handler };
