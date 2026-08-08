import { describe, expect, it } from 'vitest'
import { toCanonicalTimestamp, toDatetimeLocal } from './event-schedule.ts'

describe('Event schedule UI boundary', () => {
  it('converts a canonical timestamp to a datetime-local value', () => {
    const date = new Date('2026-08-06T09:00:00.000Z')
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    expect(toDatetimeLocal('2026-08-06T09:00:00.000Z')).toBe(expected)
  })

  it('converts a datetime-local value back to a canonical timestamp', () => {
    expect(toCanonicalTimestamp('2026-08-06T09:00')).toBe(new Date('2026-08-06T09:00').toISOString())
    expect(toCanonicalTimestamp('')).toBeUndefined()
  })
})
