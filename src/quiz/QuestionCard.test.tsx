import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuestionCard from './QuestionCard'
import type { Question } from '../types/quiz'

const question: Question = {
  id: 'q1',
  category: 'world',
  question: '테스트 문제',
  options: ['가', '나', '다', '라'],
  correctIndex: 1,
}

describe('QuestionCard', () => {
  it('calls onSelect with the clicked option index', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={null}
        onSelect={onSelect}
        onNext={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: '나' }))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('marks the correct option and the wrong pick once answered, and disables all options', () => {
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={0}
        onSelect={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '가' })).toHaveAttribute('data-status', 'incorrect')
    expect(screen.getByRole('button', { name: '나' })).toHaveAttribute('data-status', 'correct')
    expect(screen.getByRole('button', { name: '가' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '나' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '라' })).toBeDisabled()
  })

  it('shows "결과 보기" as the next-button label on the last question', () => {
    render(
      <QuestionCard
        question={question}
        index={4}
        total={5}
        selectedOption={1}
        onSelect={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '결과 보기' })).toBeInTheDocument()
  })

  it('shows "다음 문제" on non-final questions and calls onNext when clicked', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={1}
        onSelect={vi.fn()}
        onNext={onNext}
      />,
    )
    await user.click(screen.getByRole('button', { name: '다음 문제' }))
    expect(onNext).toHaveBeenCalled()
  })

  it('does not show a next button before an option is selected', () => {
    render(
      <QuestionCard
        question={question}
        index={0}
        total={5}
        selectedOption={null}
        onSelect={vi.fn()}
        onNext={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: '다음 문제' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '결과 보기' })).not.toBeInTheDocument()
  })
})
