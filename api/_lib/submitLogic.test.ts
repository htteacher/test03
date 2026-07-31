import { describe, it, expect, vi } from 'vitest'
import { submitQuizResult } from './submitLogic.js'
import type { SubmissionStore } from './submitLogic.js'
import type { Submission } from '../../src/types/quiz.js'

const submission: Submission = {
  className: '3-2',
  studentNumber: 7,
  category: 'world',
  score: 8,
  total: 10,
}

function fakeStore(usedCount: number) {
  return {
    async countSubmissions() {
      return usedCount
    },
    insertSubmission: vi.fn(async () => {}),
  } satisfies SubmissionStore
}

describe('submitQuizResult', () => {
  it('inserts the submission when under the attempt limit', async () => {
    const store = fakeStore(1)
    const result = await submitQuizResult(store, submission)
    expect(result).toEqual({ ok: true })
    expect(store.insertSubmission).toHaveBeenCalledWith(submission)
  })

  it('rejects the submission once the attempt limit is reached', async () => {
    const store = fakeStore(3)
    const result = await submitQuizResult(store, submission)
    expect(result).toEqual({ ok: false, reason: 'limit-reached' })
    expect(store.insertSubmission).not.toHaveBeenCalled()
  })
})
