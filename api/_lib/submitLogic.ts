import { MAX_ATTEMPTS } from './attemptsLogic.js'
import type { Submission } from '../../src/types/quiz.js'

export interface SubmissionStore {
  countSubmissions(className: string, studentNumber: number): Promise<number>
  insertSubmission(submission: Submission): Promise<void>
}

export type SubmitResult = { ok: true } | { ok: false; reason: 'limit-reached' }

export async function submitQuizResult(
  store: SubmissionStore,
  submission: Submission,
): Promise<SubmitResult> {
  const used = await store.countSubmissions(submission.className, submission.studentNumber)
  if (used >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'limit-reached' }
  }
  await store.insertSubmission(submission)
  return { ok: true }
}
