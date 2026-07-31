export type Category = 'world' | 'korea'

export interface Question {
  id: string
  category: Category
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
}

export interface Submission {
  className: string
  studentNumber: number
  category: Category
  score: number
  total: number
}

export interface SubmissionRecord extends Submission {
  id: string
  createdAt: string
}
