import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntroScreen from './IntroScreen'

describe('IntroScreen', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps the confirm button disabled until class and number are filled in', async () => {
    const user = userEvent.setup()
    render(
      <IntroScreen
        attemptsRemaining={null}
        attemptsError={null}
        onIdentify={vi.fn()}
        onStart={vi.fn()}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled()
    await user.type(screen.getByLabelText('반'), '3-2')
    await user.type(screen.getByLabelText('번호'), '7')
    expect(screen.getByRole('button', { name: '확인' })).toBeEnabled()
  })

  it('calls onIdentify with the entered class and number', async () => {
    const user = userEvent.setup()
    const onIdentify = vi.fn()
    render(
      <IntroScreen
        attemptsRemaining={null}
        attemptsError={null}
        onIdentify={onIdentify}
        onStart={vi.fn()}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    await user.type(screen.getByLabelText('반'), '3-2')
    await user.type(screen.getByLabelText('번호'), '7')
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onIdentify).toHaveBeenCalledWith('3-2', 7)
  })

  it('shows a blocked message and hides the start controls when no attempts remain', () => {
    render(
      <IntroScreen
        attemptsRemaining={0}
        attemptsError={null}
        onIdentify={vi.fn()}
        onStart={vi.fn()}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    expect(screen.getByText('이미 3회 응시했습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '시작하기' })).not.toBeInTheDocument()
  })

  it('lets the student pick a question count and start the quiz', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(
      <IntroScreen
        attemptsRemaining={2}
        attemptsError={null}
        onIdentify={vi.fn()}
        onStart={onStart}
        onOpenTeacherGate={vi.fn()}
      />,
    )
    await user.click(screen.getByLabelText('5문제'))
    await user.click(screen.getByRole('button', { name: '시작하기' }))
    expect(onStart).toHaveBeenCalledWith(5)
  })
})
