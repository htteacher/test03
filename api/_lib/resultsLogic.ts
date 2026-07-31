import type { SubmissionRecord } from '../../src/types/quiz'

export interface ResultsStore {
  listSubmissions(): Promise<SubmissionRecord[]>
}

export type ResultsAuthResult =
  | { ok: true; results: SubmissionRecord[] }
  | { ok: false; reason: 'unauthorized' }

export async function getTeacherResults(
  store: ResultsStore,
  password: string,
  expectedPassword: string,
): Promise<ResultsAuthResult> {
  if (password !== expectedPassword) {
    return { ok: false, reason: 'unauthorized' }
  }
  const results = await store.listSubmissions()
  return { ok: true, results }
}
