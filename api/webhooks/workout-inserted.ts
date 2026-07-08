import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateWorkoutCard, type WorkoutRow } from '../_workout-card.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${process.env.SUPABASE_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, table, record } = req.body as {
    type: string;
    table: string;
    record: WorkoutRow & { proof_image?: string | null };
  };

  if ((type !== 'INSERT' && type !== 'UPDATE') || table !== 'workouts') {
    return res.status(200).json({ skipped: 'not an insert/update on workouts' });
  }

  if (record?.source !== 'google_health' && record?.source !== 'apple_health') {
    return res.status(200).json({ skipped: 'not a health source' });
  }

  // 자동생성 카드는 스탯 변경 시 재생성 대상, 사용자 업로드 사진은 보존
  if (record?.proof_image && !record.proof_image.includes('/workout-cards/')) {
    return res.status(200).json({ skipped: 'user-uploaded proof_image preserved' });
  }

  try {
    const imageUrl = await generateWorkoutCard(record);
    if (imageUrl) {
      // 같은 id 재생성 시 R2 키가 동일 → 브라우저/CDN 캐시 무효화용 버전 쿼리
      const versionedUrl = `${imageUrl}?v=${Date.now()}`;
      await supabase.from('workouts').update({ proof_image: versionedUrl }).eq('id', record.id);
    }
  } catch (err) {
    console.error('workout-inserted handler error:', err);
  }

  return res.status(200).end();
}
