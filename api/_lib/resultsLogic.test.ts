import { describe, it, expect } from 'vitest'
import { getTeacherResults } from './resultsLogic'
import type { ResultsStore } from './resultsLogic'
import type { SubmissionRecord } from '../../src/types/quiz'

const records: SubmissionRecord[] = [
  {
    id: '1',
    className: '3-2',
    studentNumber: 7,
    category: 'world',
    score: 8,
    total: 10,
    createdAt: '2026-07-31T00:00:00Z',
  },
]

function fakeStore(): ResultsStore {
  return {
    async listSubmissions() {
      return records
    },
  }
}

describe('getTeacherResults', () => {
  it('returns the submissions when the password matches', async () => {
    const result = await getTeacherResults(fakeStore(), 'secret', 'secret')
    expect(result).toEqual({ ok: true, results: records })
  })

  it('rejects a wrong password without querying the store', async () => {
    const result = await getTeacherResults(fakeStore(), 'wrong', 'secret')
    expect(result).toEqual({ ok: false, reason: 'unauthorized' })
  })
})
