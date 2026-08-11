import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// _firebase-admin.ts 의 구식 namespace import(`import admin from 'firebase-admin'`)는
// firebase-admin v14 타입 정의와 안 맞아 컴파일 에러가 난다 (아무도 안 써서 안 걸렸음).
// api/sync/trigger.ts 가 쓰는 modular import 가 실제 프로덕션에서 검증된 패턴이라 그대로 따른다.
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string;
  workout_id: string | null;
  club_id: string | null;
  type: string;
  comment_text: string | null;
  comment_id: string | null;
  read: boolean;
  created_at: string;
}

const MAX_BODY_LEN = 80;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${process.env.SUPABASE_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, table, record } = req.body as {
    type: string;
    table: string;
    record: NotificationRow;
  };

  if (type !== 'INSERT' || table !== 'notifications') {
    return res.status(200).json({ skipped: 'not an insert on notifications' });
  }

  if (record.user_id === record.actor_id) {
    return res.status(200).json({ skipped: 'self notification' });
  }

  if (record.type !== 'like' && record.type !== 'comment') {
    return res.status(200).json({ skipped: `unhandled type: ${record.type}` });
  }

  try {
    const { data: recipient } = await supabase
      .from('users')
      .select('push_muted')
      .eq('id', record.user_id)
      .maybeSingle();

    if (recipient?.push_muted) {
      return res.status(200).json({ skipped: 'push muted' });
    }

    const { data: tokenRows } = await supabase
      .from('device_tokens')
      .select('fcm_token')
      .eq('user_id', record.user_id);

    const fcmTokens = (tokenRows ?? []).map((t) => t.fcm_token as string);
    if (!fcmTokens.length) {
      return res.status(200).json({ skipped: 'no device tokens' });
    }

    const { data: actor } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', record.actor_id)
      .maybeSingle();
    const actorName = actor?.display_name || '누군가';

    let body = '';
    if (record.type === 'like' && record.workout_id) {
      const { data: workout } = await supabase
        .from('workouts')
        .select('category, value, unit')
        .eq('id', record.workout_id)
        .maybeSingle();
      if (workout) {
        body = `${workout.category} ${workout.value}${workout.unit}`;
      }
    } else if (record.type === 'comment') {
      body = (record.comment_text || '').slice(0, MAX_BODY_LEN);
    }

    const title =
      record.type === 'like' ? `${actorName}님이 좋아요를 눌렀어요` : `${actorName}님이 댓글을 남겼어요`;

    const path = record.workout_id ? `/workout/${record.workout_id}` : '/';

    const message = {
      tokens: fcmTokens,
      data: {
        action: 'social',
        type: record.type,
        title,
        body,
        path,
        notification_id: record.id,
      },
      android: { priority: 'high' as const },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
          },
        },
      },
    };

    const result = await getMessaging().sendEachForMulticast(message);
    return res.status(200).json({ sent: result.successCount, failed: result.failureCount });
  } catch (err) {
    console.error('notification-inserted handler error:', err);
    return res.status(200).json({ error: 'send failed, see logs' });
  }
}
