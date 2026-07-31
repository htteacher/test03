import { createClient } from '@supabase/supabase-js'
import type { Submission, SubmissionRecord } from '../../src/types/quiz.js'
import type { AttemptCounter } from './attemptsLogic.js'
import type { SubmissionStore } from './submitLogic.js'
import type { ResultsStore } from './resultsLogic.js'

export function createSupabaseAdminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRoleKey)
}

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>

export function createSubmissionStore(
  supabase: SupabaseAdminClient,
): AttemptCounter & SubmissionStore & ResultsStore {
  return {
    async countSubmissions(className: string, studentNumber: number): Promise<number> {
      const { count, error } = await supabase
        .from('quiz_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('class_name', className)
        .eq('student_number', studentNumber)
      if (error) throw error
      return count ?? 0
    },
    async insertSubmission(submission: Submission): Promise<void> {
      const { error } = await supabase.from('quiz_submissions').insert({
        class_name: submission.className,
        student_number: submission.studentNumber,
        category: submission.category,
        score: submission.score,
        total: submission.total,
      })
      if (error) throw error
    },
    async listSubmissions(): Promise<SubmissionRecord[]> {
      const { data, error } = await supabase
        .from('quiz_submissions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id as string,
        className: row.class_name as string,
        studentNumber: row.student_number as number,
        category: row.category as Submission['category'],
        score: row.score as number,
        total: row.total as number,
        createdAt: row.created_at as string,
      }))
    },
  }
}
