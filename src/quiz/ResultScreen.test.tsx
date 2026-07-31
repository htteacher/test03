import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultScreen from './ResultScreen'

describe('ResultScreen', () => {
  it('shows the score and calls onSubmit once on mount', () => {
    const onSubmit = vi.fn()
    render(
      <ResultScreen score={8} total={10} submitStatus="idle" onSubmit={onSubmit} onRestart={vi.fn()} />,
    )
    expect(screen.getByText('10문제 중 8개 정답')).toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('offers a retry button when saving fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <ResultScreen score={8} total={10} submitStatus="error" onSubmit={onSubmit} onRestart={vi.fn()} />,
    )
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('shows a limit-reached message without a retry button', () => {
    render(
      <ResultScreen
        score={8}
        total={10}
        submitStatus="limit-reached"
        onSubmit={vi.fn()}
        onRestart={vi.fn()}
      />,
    )
    expect(screen.getByText('이미 3회 응시했습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('calls onRestart when the restart button is clicked', async () => {
    const user = userEvent.setup()
    const onRestart = vi.fn()
    render(
      <ResultScreen score={8} total={10} submitStatus="saved" onSubmit={vi.fn()} onRestart={onRestart} />,
    )
    await user.click(screen.getByRole('button', { name: '다시 풀기' }))
    expect(onRestart).toHaveBeenCalled()
  })
})
