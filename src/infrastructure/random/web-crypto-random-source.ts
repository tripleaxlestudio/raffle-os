import {
  RandomSourceError,
  UINT32_MAX,
  type RandomSource,
} from '../../application/draw/random-source.ts'

type CryptoRandomValues = Pick<Crypto, 'getRandomValues'>

export function createWebCryptoRandomSource(
  cryptoObject: CryptoRandomValues | null | undefined = globalThis.crypto,
): RandomSource {
  return {
    nextUint32: () => nextUint32(cryptoObject),
  }
}

function nextUint32(cryptoObject: CryptoRandomValues | null | undefined): number {
  if (!cryptoObject || typeof cryptoObject.getRandomValues !== 'function') {
    throw new RandomSourceError(
      'random-source-unavailable',
      'Web Crypto is unavailable; secure randomness cannot be provided.',
    )
  }

  const values = new Uint32Array(1)
  let result: Uint32Array
  try {
    result = cryptoObject.getRandomValues(values)
  } catch (error) {
    throw new RandomSourceError(
      'random-source-read-failed',
      'Web Crypto could not provide secure randomness.',
      { cause: error },
    )
  }

  if (!(result instanceof Uint32Array) || result.length !== 1 || result !== values) {
    throw new RandomSourceError(
      'invalid-random-value',
      'Web Crypto returned an invalid unsigned 32-bit value.',
    )
  }

  const value = result[0]
  if (value === undefined || !Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RandomSourceError(
      'invalid-random-value',
      'Web Crypto returned an invalid unsigned 32-bit value.',
    )
  }
  return value
}
