import { describe, expect, it } from 'vitest'
import { formatProductionDateTime, formatProductionNumber, productionDomainLabel, productionMessage, productionMessages, PRODUCTION_LOCALE } from './production-locale.ts'

describe('production locale boundary', () => {
  it('provides a non-empty Indonesian message for every typed production key', () => {
    expect(PRODUCTION_LOCALE).toBe('id-ID')
    expect(Object.keys(productionMessages).length).toBeGreaterThan(0)
    for (const [key, value] of Object.entries(productionMessages)) {
      expect(value.trim(), key).not.toBe('')
      expect(productionMessage(key as keyof typeof productionMessages)).toBe(value)
    }
  })

  it('formats presentation values with id-ID without coercing identifiers', () => {
    expect(formatProductionNumber(10_000)).toBe('10.000')
    expect(formatProductionDateTime('2026-08-28T08:15:00.000Z')).toMatch(/2026/)
    expect(productionDomainLabel('live')).toBe('Mode Live')
    expect(productionDomainLabel('00042')).toBe('00042')
  })
})
