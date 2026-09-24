import { describe, expect, it, vi } from 'vitest'
import { createDrawConfigurationId, createDrawSessionId } from './identifiers.ts'

describe('secure identifier generation', () => {
  it('falls back to Web Crypto getRandomValues when randomUUID is unavailable', () => {
    const cryptoSource = globalThis.crypto
    const randomUUID = vi.spyOn(cryptoSource, 'randomUUID').mockImplementation(() => {
      throw new TypeError('randomUUID unavailable')
    })
    const getRandomValues = vi.spyOn(cryptoSource, 'getRandomValues')

    expect(createDrawConfigurationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(createDrawSessionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    expect(getRandomValues).toHaveBeenCalledTimes(2)
    randomUUID.mockRestore()
    getRandomValues.mockRestore()
  })
})
