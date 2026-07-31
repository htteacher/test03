import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TeacherGate from './TeacherGate'

describe('TeacherGate', () => {
  it('disables the confirm button until a password is entered', async () => {
    const user = userEvent.setup()
    render(<TeacherGate error={null} onSubmitPassword={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled()
    await user.type(screen.getByLabelText('비밀번호'), 'secret')
    expect(screen.getByRole('button', { name: '확인' })).toBeEnabled()
  })

  it('calls onSubmitPassword with the entered value', async () => {
    const user = userEvent.setup()
    const onSubmitPassword = vi.fn()
    render(<TeacherGate error={null} onSubmitPassword={onSubmitPassword} onBack={vi.fn()} />)
    await user.type(screen.getByLabelText('비밀번호'), 'secret')
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onSubmitPassword).toHaveBeenCalledWith('secret')
  })

  it('shows an error message when provided', () => {
    render(<TeacherGate error="비밀번호가 틀렸습니다" onSubmitPassword={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('비밀번호가 틀렸습니다')).toBeInTheDocument()
  })

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<TeacherGate error={null} onSubmitPassword={vi.fn()} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: '돌아가기' }))
    expect(onBack).toHaveBeenCalled()
  })
})
