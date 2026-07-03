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

  if (type !== 'INSERT' || table !== 'workouts') {
    return res.status(200).json({ skipped: 'not an insert on workouts' });
  }

  if (record?.source !== 'google_health' && record?.source !== 'apple_health') {
    return res.status(200).json({ skipped: 'not a health source' });
  }

  if (record?.proof_image) {
    return res.status(200).json({ skipped: 'proof_image already set' });
  }

  try {
    const imageUrl = await generateWorkoutCard(record);
    if (imageUrl) {
      await supabase.from('workouts').update({ proof_image: imageUrl }).eq('id', record.id);
    }
  } catch (err) {
    console.error('workout-inserted handler error:', err);
  }

  return res.status(200).end();
}
