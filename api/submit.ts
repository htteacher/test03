import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdminClient, createSubmissionStore } from './_lib/supabaseAdmin.js'
import { submitQuizResult } from './_lib/submitLogic.js'
import type { Submission } from '../src/types/quiz.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { className, studentNumber, category, score, total } = req.body ?? {}
  if (
    typeof className !== 'string' ||
    typeof studentNumber !== 'number' ||
    (category !== 'world' && category !== 'korea') ||
    typeof score !== 'number' ||
    typeof total !== 'number'
  ) {
    res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' })
    return
  }

  const submission: Submission = { className, studentNumber, category, score, total }

  try {
    const store = createSubmissionStore(createSupabaseAdminClient())
    const result = await submitQuizResult(store, submission)
    if (!result.ok) {
      res.status(403).json({ error: '이미 3회 응시했습니다.' })
      return
    }
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '결과를 저장하지 못했습니다.' })
  }
}
