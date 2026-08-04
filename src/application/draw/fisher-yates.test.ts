import { describe, expect, it } from 'vitest'
import { fisherYatesShuffle } from './fisher-yates.ts'
import type { RandomSource } from './random-source.ts'

function sequence(...values: number[]): RandomSource & { readonly consumed: number[] } {
  const consumed: number[] = []
  let index = 0
  return {
    consumed,
    nextUint32: () => {
      const value = values[index]
      index += 1
      if (value === undefined) throw new Error('Deterministic sequence exhausted.')
      consumed.push(value)
      return value
    },
  }
}

describe('fisherYatesShuffle', () => {
  it('handles empty and one-entry inputs', () => {
    const source = sequence()
    expect(fisherYatesShuffle([], source)).toEqual([])
    expect(fisherYatesShuffle(['only'], source)).toEqual(['only'])
    expect(source.consumed).toEqual([])
  })

  it('returns the deterministic Fisher–Yates vector and requests decreasing bounds', () => {
    const source = sequence(1, 0, 1)
    expect(fisherYatesShuffle(['a', 'b', 'c', 'd'], source)).toEqual(['c', 'd', 'a', 'b'])
    expect(source.consumed).toEqual([1, 0, 1])
  })

  it('does not mutate input and preserves every reference exactly once', () => {
    const first = { id: 'first' }
    const second = { id: 'second' }
    const third = { id: 'third' }
    const input = [first, second, third]
    const output = fisherYatesShuffle(input, sequence(0, 0))
    expect(input).toEqual([first, second, third])
    expect(output).toHaveLength(input.length)
    expect(new Set(output)).toEqual(new Set(input))
    expect(output).toEqual([second, third, first])
  })
})
