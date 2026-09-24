import { describe, expect, it } from 'vitest'
import { composeWinnerRows, winnerRowComposition } from './winner-layout.ts'

describe('winner row composition', () => {
  it.each([
    [1, [1]], [2, [2]], [3, [3]], [4, [2, 2]], [5, [3, 2]], [6, [3, 3]],
    [7, [4, 3]], [8, [4, 4]], [9, [5, 4]], [10, [5, 5]], [11, [4, 4, 3]],
    [12, [4, 4, 4]], [13, [5, 4, 4]], [14, [5, 5, 4]], [15, [5, 5, 5]],
    [16, [4, 4, 4, 4]], [20, [5, 5, 5, 5]], [21, [7, 7, 7]], [30, [10, 10, 10]],
    [50, [10, 10, 10, 10, 10]],
  ])('composes %i winners as %j', (count, expected) => {
    expect(winnerRowComposition(count)).toEqual(expected)
  })

  it('keeps row values ordered while grouping them by the composition', () => {
    expect(composeWinnerRows(['1', '2', '3', '4', '5', '6', '7'])).toEqual([
      ['1', '2', '3', '4'], ['5', '6', '7'],
    ])
  })
})
