import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 (Service Role Key 사용 - RLS 우회)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // 환경변수 추가 필요
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

export const handler: Handler = async (event) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // POST만 허용
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // 요청 파싱
    const body: RequestBody = JSON.parse(event.body || '{}');
    const { user_id, workout_data } = body;

    // 유효성 검증
    if (!user_id || !workout_data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'user_id and workout_data are required' }),
      };
    }

    // 1. 사용자 존재 확인 (서버 검증)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      console.error('User validation failed:', userError);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Unauthorized: Invalid user' }),
      };
    }

    // 2. Workout 데이터 삽입
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id,
        ...workout_data,
      })
      .select()
      .single();

    if (workoutError) {
      console.error('Workout insert failed:', workoutError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create workout', details: workoutError }),
      };
    }

    // 3. Audit Log 저장
    const { error: auditError } = await supabase.from('audit_logs').insert({
      user_id,
      action: 'INSERT',
      table_name: 'workouts',
      record_id: workout.id,
      new_data: workout,
      ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'],
      user_agent: event.headers['user-agent'],
    });

    if (auditError) {
      console.error('Audit log failed:', auditError);
      // 감사 로그 실패는 치명적이지 않음 (계속 진행)
    }

    // 4. 성공 응답
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        data: workout,
        message: 'Workout created successfully',
      }),
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
