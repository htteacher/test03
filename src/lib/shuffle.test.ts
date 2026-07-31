import { describe, it, expect } from 'vitest'
import { shuffle, sample } from './shuffle'

describe('shuffle', () => {
  it('returns all original elements exactly once', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3]
    shuffle(input)
    expect(input).toEqual([1, 2, 3])
  })

  it('is deterministic when given a fixed random source', () => {
    const input = [1, 2, 3, 4]
    const fixedRandom = () => 0
    expect(shuffle(input, fixedRandom)).toEqual([2, 3, 4, 1])
  })
})

describe('sample', () => {
  it('returns the requested number of items', () => {
    const input = [1, 2, 3, 4, 5]
    expect(sample(input, 3)).toHaveLength(3)
  })

  it('returns items only from the original array with no duplicates', () => {
    const input = [1, 2, 3, 4, 5]
    const result = sample(input, 5)
    expect(new Set(result).size).toBe(5)
    for (const item of result) {
      expect(input).toContain(item)
    }
  })
})
