import { describe, expect, it } from 'vitest'
import { isEventNameValid } from './event-form.ts'

describe('Event form validation', () => {
  it('rejects an empty Event name', () => expect(isEventNameValid('')).toBe(false))
  it('rejects a whitespace-only Event name', () => expect(isEventNameValid('   \t')).toBe(false))
  it('accepts a non-empty Event name after trimming', () => expect(isEventNameValid(' Gala Dinner 2026 ')).toBe(true))
})
