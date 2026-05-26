import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  console.log('🔄 월별 마일리지 스냅샷 배치 시작');

  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;

    console.log(`📅 스냅샷 생성: ${year}년 ${month}월`);

    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('id, mileage_config');

    if (clubsError) {
      console.error('❌ 클럽 조회 실패:', clubsError);
      return res.status(500).json({ error: 'Failed to fetch clubs' });
    }

    if (!clubs || clubs.length === 0) {
      console.log('ℹ️  클럽이 없습니다');
      return res.status(200).json({ message: 'No clubs to process' });
    }

    console.log(`📊 클럽 수: ${clubs.length}`);

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

    const { error } = await supabase
      .from('club_monthly_configs')
      .upsert(snapshots, { onConflict: 'club_id,year,month' });

    if (error) {
      console.error('❌ 스냅샷 저장 실패:', error);
      return res.status(500).json({ error: 'Failed to save snapshots' });
    }

    console.log(`✅ 스냅샷 저장 완료: ${clubs.length}개 클럽`);

    const { data: graduatedCount, error: rookieError } = await supabase
      .rpc('update_rookie_graduations');

    if (rookieError) {
      console.error('❌ 루키 졸업 처리 실패:', rookieError);
    } else {
      console.log(`🎓 루키 졸업 처리 완료: ${graduatedCount}명`);
    }

    return res.status(200).json({
      message: 'Monthly snapshots created successfully',
      year,
      month,
      clubCount: clubs.length,
      rookieGraduated: graduatedCount ?? 0,
    });
  } catch (error) {
    console.error('❌ 배치 실패:', error);
    return res.status(500).json({ error: 'Batch job failed', details: error });
  }
}
