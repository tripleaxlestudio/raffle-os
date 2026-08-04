import { describe, expect, it } from 'vitest'
import { RandomSourceError } from '../../application/draw/random-source.ts'
import { createWebCryptoRandomSource } from './web-crypto-random-source.ts'

describe('createWebCryptoRandomSource', () => {
  it('calls getRandomValues with one unsigned 32-bit slot', () => {
    let calls = 0
    const getRandomValues: Crypto['getRandomValues'] = <T extends Exclude<BufferSource, ArrayBuffer>>(values: T): T => {
      if (!(values instanceof Uint32Array)) throw new Error('Expected Uint32Array')
      calls += 1
      values[0] = 0x12345678
      return values
    }
    const source = createWebCryptoRandomSource({ getRandomValues })

    expect(source.nextUint32()).toBe(0x12345678)
    expect(calls).toBe(1)
  })

  it.each([0, 0xffffffff])('returns unsigned value %s', (value) => {
    const source = createWebCryptoRandomSource({
      getRandomValues: <T extends Exclude<BufferSource, ArrayBuffer>>(values: T): T => {
        if (!(values instanceof Uint32Array)) throw new Error('Expected Uint32Array')
        values[0] = value
        return values
      },
    })
    expect(source.nextUint32()).toBe(value)
  })

  it('fails explicitly when Web Crypto is unavailable', () => {
    expect(() => createWebCryptoRandomSource(null).nextUint32()).toThrowError(RandomSourceError)
    expect(() => createWebCryptoRandomSource(null).nextUint32()).toThrowError(/unavailable/)
  })

  it('does not silently fall back when getRandomValues fails', () => {
    const source = createWebCryptoRandomSource({
      getRandomValues: () => { throw new Error('blocked') },
    })
    expect(() => source.nextUint32()).toThrowError(/could not provide/)
  })

  it('rejects a malformed adapter result', () => {
    const source = createWebCryptoRandomSource({
      getRandomValues: (() => new Uint32Array([1])) as Crypto['getRandomValues'],
    })
    expect(() => source.nextUint32()).toThrowError(/invalid unsigned 32-bit/)
  })
})
