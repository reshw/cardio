import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', userId)
    .eq('platform', 'android')

  if (!tokens?.length) return res.status(200).json({ skipped: true })

  await admin.messaging().sendEachForMulticast({
    tokens: tokens.map(t => t.fcm_token),
    data: { action: 'sync' },
    android: { priority: 'high' },
  })

  res.status(200).json({ sent: tokens.length })
}
