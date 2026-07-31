import { describe, it, expect } from 'vitest'
import { QUESTIONS } from './questions'

describe('QUESTIONS', () => {
  it('has exactly 15 world-history questions', () => {
    const world = QUESTIONS.filter((q) => q.category === 'world')
    expect(world).toHaveLength(15)
  })

  it('has unique ids', () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every question exactly 4 options', () => {
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4)
    }
  })

  it('keeps correctIndex within the options range', () => {
    for (const q of QUESTIONS) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThanOrEqual(3)
    }
  })
})
