import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdminClient, createSubmissionStore } from './_lib/supabaseAdmin.js'
import { getTeacherResults } from './_lib/resultsLogic.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { password } = req.body ?? {}
  const expectedPassword = process.env.TEACHER_PASSWORD
  if (typeof password !== 'string' || !expectedPassword) {
    res.status(500).json({ error: '서버에 비밀번호가 설정되어 있지 않습니다.' })
    return
  }

  try {
    const store = createSubmissionStore(createSupabaseAdminClient())
    const result = await getTeacherResults(store, password, expectedPassword)
    if (!result.ok) {
      res.status(401).json({ error: '비밀번호가 틀렸습니다.' })
      return
    }
    res.status(200).json({ results: result.results })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '결과를 불러오지 못했습니다.' })
  }
}
