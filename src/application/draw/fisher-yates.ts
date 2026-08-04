import { boundedRandomInteger } from './bounded-random-integer.ts'
import type { RandomSource } from './random-source.ts'

export function fisherYatesShuffle<T>(
  input: readonly T[],
  randomSource: RandomSource,
): T[] {
  const shuffled = [...input]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = boundedRandomInteger(index + 1, randomSource)
    const current = shuffled[index]
    const replacement = shuffled[swapIndex]
    shuffled[index] = replacement
    shuffled[swapIndex] = current
  }
  return shuffled
}
