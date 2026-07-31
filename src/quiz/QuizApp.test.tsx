import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizApp from './QuizApp'

function jsonResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

describe('QuizApp', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks attempts, runs a full quiz round, and submits the score', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementationOnce(() => jsonResponse(200, { remaining: 3 }))
    fetchMock.mockImplementationOnce(() => jsonResponse(200, { ok: true }))

    render(<QuizApp />)

    await user.type(screen.getByLabelText('반'), '3-2')
    await user.type(screen.getByLabelText('번호'), '7')
    await user.click(screen.getByRole('button', { name: '확인' }))

    expect(await screen.findByText('남은 응시 횟수: 3회')).toBeInTheDocument()

    await user.click(screen.getByLabelText('5문제'))
    await user.click(screen.getByRole('button', { name: '시작하기' }))

    expect(screen.getByText('1 / 5')).toBeInTheDocument()

    for (let i = 0; i < 5; i += 1) {
      const options = screen
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('data-status'))
      await user.click(options[0])
      const isLast = i === 4
      await user.click(screen.getByRole('button', { name: isLast ? '결과 보기' : '다음 문제' }))
    }

    expect(await screen.findByText('저장 완료')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/submit',
      expect.objectContaining({
        body: expect.stringContaining('"className":"3-2"'),
      }),
    )
  })
})
