import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TeacherResults from './TeacherResults'
import type { SubmissionRecord } from '../types/quiz'

describe('TeacherResults', () => {
  it('shows an empty-state message when there are no results', () => {
    render(<TeacherResults results={[]} onBack={() => {}} />)
    expect(screen.getByText('아직 제출된 결과가 없습니다.')).toBeInTheDocument()
  })

  it('lists each submission in a table row', () => {
    const results: SubmissionRecord[] = [
      {
        id: '1',
        className: '3-2',
        studentNumber: 7,
        category: 'world',
        score: 8,
        total: 10,
        createdAt: '2026-07-31T00:00:00Z',
      },
      {
        id: '2',
        className: '3-1',
        studentNumber: 3,
        category: 'world',
        score: 5,
        total: 10,
        createdAt: '2026-07-31T00:05:00Z',
      },
    ]
    render(<TeacherResults results={results} onBack={() => {}} />)
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('3-2')).toBeInTheDocument()
    expect(screen.getByText('8 / 10')).toBeInTheDocument()
  })
})
