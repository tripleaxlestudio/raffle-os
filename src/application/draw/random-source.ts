export const UINT32_DOMAIN_SIZE = 2 ** 32
export const UINT32_MAX = UINT32_DOMAIN_SIZE - 1

export interface RandomSource {
  nextUint32(): number
}

export type RandomSourceErrorCode =
  | 'random-source-unavailable'
  | 'random-source-read-failed'
  | 'invalid-random-value'

export class RandomSourceError extends Error {
  readonly code: RandomSourceErrorCode

  constructor(code: RandomSourceErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RandomSourceError'
    this.code = code
  }
}

export function assertUint32(value: number): asserts value is number {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RandomSourceError(
      'invalid-random-value',
      'Random sources must return an unsigned 32-bit integer.',
    )
  }
}
