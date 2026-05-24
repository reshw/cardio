import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WorkoutData {
  user_id: string;
  workout_type_id: string;
  sub_type?: string;
  distance?: number;
  duration?: number;
  calories?: number;
  average_heart_rate?: number;
  memo?: string;
  workout_date: string;
  image_url?: string;
  is_public?: boolean;
}

interface RequestBody {
  user_id: string;
  workout_data: WorkoutData;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user_id, workout_data } = req.body as RequestBody;

    if (!user_id || !workout_data) {
      return res.status(400).json({ error: 'user_id and workout_data are required' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('User validation failed:', userError);
      return res.status(403).json({ error: 'Unauthorized: Invalid user' });
    }

    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({ user_id, ...workout_data })
      .select()
      .single();

    if (workoutError) {
      console.error('Workout insert failed:', workoutError);
      return res.status(500).json({ error: 'Failed to create workout', details: workoutError });
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      user_id,
      action: 'INSERT',
      table_name: 'workouts',
      record_id: workout.id,
      new_data: workout,
      ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      user_agent: req.headers['user-agent'],
    });

    if (auditError) console.error('Audit log failed:', auditError);

    return res.status(201).json({ success: true, data: workout, message: 'Workout created successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
