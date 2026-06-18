import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

if (!getApps().length) {
  initializeApp({
    credential: cert({
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
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end()

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('fcm_token')
    .eq('platform', 'android')

  if (!tokens?.length) return res.status(200).json({ skipped: true })

  const fcmTokens = tokens.map(t => t.fcm_token)

  const chunkSize = 500
  let totalSent = 0
  for (let i = 0; i < fcmTokens.length; i += chunkSize) {
    const chunk = fcmTokens.slice(i, i + chunkSize)
    await getMessaging().sendEachForMulticast({
      tokens: chunk,
      data: { action: 'sync' },
      android: { priority: 'high' },
    })
    totalSent += chunk.length
  }

  res.status(200).json({ sent: totalSent })
}
