import { describe, it, expect } from 'vitest'
import { getRemainingAttempts, MAX_ATTEMPTS } from './attemptsLogic'
import type { AttemptCounter } from './attemptsLogic'

function fakeCounter(count: number): AttemptCounter {
  return {
    async countSubmissions() {
      return count
    },
  }
}

describe('getRemainingAttempts', () => {
  it('returns the full quota when nothing has been submitted yet', async () => {
    const remaining = await getRemainingAttempts(fakeCounter(0), '3-2', 7)
    expect(remaining).toBe(MAX_ATTEMPTS)
  })

  it('subtracts previously used attempts', async () => {
    const remaining = await getRemainingAttempts(fakeCounter(2), '3-2', 7)
    expect(remaining).toBe(1)
  })

  it('never goes below zero', async () => {
    const remaining = await getRemainingAttempts(fakeCounter(5), '3-2', 7)
    expect(remaining).toBe(0)
  })
})
