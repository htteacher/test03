import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdminClient, createSubmissionStore } from './_lib/supabaseAdmin.js'
import { getRemainingAttempts } from './_lib/attemptsLogic.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { className, studentNumber } = req.body ?? {}
  if (typeof className !== 'string' || typeof studentNumber !== 'number') {
    res.status(400).json({ error: 'className과 studentNumber가 필요합니다.' })
    return
  }

  try {
    const store = createSubmissionStore(createSupabaseAdminClient())
    const remaining = await getRemainingAttempts(store, className, studentNumber)
    res.status(200).json({ remaining })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '응시 횟수를 확인하지 못했습니다.' })
  }
}
