import { describe, expect, it } from 'vitest'
import { checkpointFromState } from './presentation-checkpoint.types.ts'
import { validatePresentationCheckpoint } from './presentation-checkpoint.validation.ts'
import { withBlackout } from './presentation-workflow.types.ts'

const session = '11111111-1111-4111-8111-111111111111' as never
const startedAt = '2026-08-05T01:00:00.000Z' as never
const persistedAt = '2026-08-05T01:00:01.000Z' as never

describe('presentation workflow contracts', () => {
  it('persists only approved stages and keeps blackout orthogonal', () => {
    const state = { stage: 'rolling' as const, drawSessionId: session, stageStartedAt: startedAt, blackoutRequested: false }
    const checkpoint = checkpointFromState(state, persistedAt)
    expect(validatePresentationCheckpoint(checkpoint)).toEqual(checkpoint)
    expect(withBlackout(state, true)).toMatchObject({ stage: 'rolling', blackoutRequested: true })
    expect(() => validatePresentationCheckpoint({ ...checkpoint, stage: 'starting' })).toThrow()
  })

  it('rejects unsupported versions, malformed IDs, and timestamps', () => {
    const checkpoint = checkpointFromState({ stage: 'reveal', drawSessionId: session, stageStartedAt: startedAt, blackoutRequested: false }, persistedAt)
    expect(() => validatePresentationCheckpoint({ ...checkpoint, checkpointFormatVersion: 9 })).toThrow('unsupported')
    expect(() => validatePresentationCheckpoint({ ...checkpoint, drawSessionId: 'not-an-id' })).toThrow('invalid')
    expect(() => validatePresentationCheckpoint({ ...checkpoint, persistedAt: 'not-a-date' })).toThrow('invalid')
  })

  it('has no result or participant payload in the persisted shape', () => {
    const checkpoint = checkpointFromState({ stage: 'countdown', drawSessionId: session, stageStartedAt: startedAt, blackoutRequested: false }, persistedAt)
    expect(Object.keys(checkpoint).sort()).toEqual(['blackoutRequested', 'checkpointFormatVersion', 'drawSessionId', 'persistedAt', 'presentationPolicyVersion', 'stage', 'stageStartedAt'].sort())
  })
})
