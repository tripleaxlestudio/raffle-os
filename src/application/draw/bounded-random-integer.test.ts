import { describe, expect, it } from 'vitest'
import { boundedRandomInteger } from './bounded-random-integer.ts'
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

describe('boundedRandomInteger', () => {
  it.each([
    [1, 0xffffffff, 0],
    [2, 0, 0],
    [2, 0xffffffff, 1],
    [3, 5, 2],
    [10, 19, 9],
    [2 ** 32, 0xffffffff, 0xffffffff],
  ])('returns %s for source value %s and bound %s', (bound, sourceValue, expected) => {
    expect(boundedRandomInteger(bound, sequence(sourceValue))).toBe(expected)
  })

  it('rejects the incomplete high range and consumes the retry', () => {
    const source = sequence(0xffffffff, 7)
    expect(boundedRandomInteger(10, source)).toBe(7)
    expect(source.consumed).toEqual([0xffffffff, 7])
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32 + 1, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsupported bound %s',
    (bound) => expect(() => boundedRandomInteger(bound, sequence(0))).toThrowError(/exclusive upper bound/),
  )

  it('rejects invalid values returned by an injected source', () => {
    expect(() => boundedRandomInteger(2, sequence(-1))).toThrowError(/unsigned 32-bit/)
    expect(() => boundedRandomInteger(2, sequence(2 ** 32))).toThrowError(/unsigned 32-bit/)
    expect(() => boundedRandomInteger(2, sequence(1.5))).toThrowError(/unsigned 32-bit/)
  })
})
