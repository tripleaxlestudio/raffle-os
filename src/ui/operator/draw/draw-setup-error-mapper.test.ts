import { describe, expect, it } from 'vitest'
import { mapDrawSetupError } from './draw-setup-error-mapper.ts'

describe('Draw Setup error mapper', () => {
  it.each([
    ['event-not-found', 'event-not-found', false, true],
    ['configuration-not-found', 'configuration-not-found', false, true],
    ['category-not-found', 'category-not-found', false, true],
    ['session-not-found', 'session-not-found', false, true],
    ['session-event-mismatch', 'relationship-mismatch', false, true],
    ['session-not-ready', 'stale-session', false, true],
    ['participants-load-failed', 'no-participants', false, true],
    ['candidate-pool-failed', 'candidate-pool-integrity', false, true],
    ['selection-failed', 'random-source-failure', true, false],
    ['session-already-has-winners', 'duplicate-execution', false, true],
    ['persistence-failed', 'persistence-failure', true, false],
    ['eligibility-failed', 'eligibility-integrity', false, true],
  ])('maps %s to a safe typed presentation', (input, output, retryable, blocked) => {
    const result = mapDrawSetupError({ code: input, message: 'internal detail', kind: 'validation' })
    expect(result.code).toBe(output)
    expect(result.retryable).toBe(retryable)
    expect(result.remainBlocked).toBe(blocked)
    expect(result.explanation).not.toContain('internal detail')
  })

  it('maps capacity and unknown failures without exposing diagnostics', () => {
    expect(mapDrawSetupError({ code: 'candidate-pool-failed', kind: 'capacity', message: 'internal capacity detail' }).code).toBe('insufficient-capacity')
    const unknown = mapDrawSetupError(new Error('private stack trace'))
    expect(unknown.code).toBe('unknown-failure')
    expect(unknown.explanation).not.toContain('private stack trace')
  })
})
