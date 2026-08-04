import {
  assertUint32,
  RandomSourceError,
  UINT32_DOMAIN_SIZE,
  type RandomSource,
} from './random-source.ts'

export function boundedRandomInteger(
  exclusiveUpperBound: number,
  randomSource: RandomSource,
): number {
  validateBound(exclusiveUpperBound)

  const acceptanceLimit = UINT32_DOMAIN_SIZE - (UINT32_DOMAIN_SIZE % exclusiveUpperBound)
  while (true) {
    const value = randomSource.nextUint32()
    assertUint32(value)
    if (value < acceptanceLimit) return value % exclusiveUpperBound
  }
}

function validateBound(exclusiveUpperBound: number): void {
  if (
    !Number.isSafeInteger(exclusiveUpperBound)
    || exclusiveUpperBound <= 0
    || exclusiveUpperBound > UINT32_DOMAIN_SIZE
  ) {
    throw new RandomSourceError(
      'invalid-random-value',
      'The exclusive upper bound must be a positive safe integer no greater than 2^32.',
    )
  }
}
