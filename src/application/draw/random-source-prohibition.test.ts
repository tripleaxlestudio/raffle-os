import { describe, expect, it } from 'vitest'

const productionModules = import.meta.glob([
  './random-source.ts',
  './bounded-random-integer.ts',
  './fisher-yates.ts',
  '../../infrastructure/random/web-crypto-random-source.ts',
], { eager: true, import: 'default', query: '?raw' })

describe('secure random production modules', () => {
  it('do not contain Math.random()', () => {
    for (const [path, source] of Object.entries(productionModules)) {
      expect(String(source), path).not.toContain('Math.random(')
    }
  })
})
