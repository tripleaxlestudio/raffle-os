import { afterEach, describe, expect, it } from 'vitest'
import { checkpointFromState } from '../../domain/workflow/presentation-checkpoint.types.ts'
import { ParticipantMutationLockedError } from './errors/persistence-errors.ts'
import { assertParticipantMutationAllowed } from './participant-mutation-lock.ts'
import { TIME_1, makeDrawHistoryFixture, cleanupTestDatabases, openTestDatabase } from './test/draw-history-test-helpers.ts'

describe('participant mutation lock', () => {
  afterEach(async () => { await cleanupTestDatabases() })

  it('keeps an orphaned official result locked when its checkpoint is missing', async () => {
    const database = await openTestDatabase('mutation-lock-orphan')
    const fixture = makeDrawHistoryFixture()
    await database.events.add(fixture.event)
    await database.draw_sessions.add({ ...fixture.session, status: 'pending-confirmation', configurationSnapshot: fixture.snapshots.configurationSnapshot, candidatePoolSnapshot: fixture.snapshots.candidatePoolSnapshot })

    await expect(assertParticipantMutationAllowed(database, fixture.event.id)).rejects.toBeInstanceOf(ParticipantMutationLockedError)
  })

  it.each(['countdown', 'rolling', 'reveal'] as const)('keeps a %s presentation locked', async (stage) => {
    const database = await openTestDatabase(`mutation-lock-${stage}`)
    const fixture = makeDrawHistoryFixture()
    await database.events.add(fixture.event)
    await database.draw_sessions.add({ ...fixture.session, status: 'pending-confirmation', configurationSnapshot: fixture.snapshots.configurationSnapshot, candidatePoolSnapshot: fixture.snapshots.candidatePoolSnapshot })
    await database.presentation_checkpoints.add(checkpointFromState({ drawSessionId: fixture.session.id, stage, stageStartedAt: TIME_1, blackoutRequested: false }, TIME_1))

    await expect(assertParticipantMutationAllowed(database, fixture.event.id)).rejects.toBeInstanceOf(ParticipantMutationLockedError)
  })

  it('releases the lock only after pending handoff', async () => {
    const database = await openTestDatabase('mutation-lock-release')
    const fixture = makeDrawHistoryFixture()
    await database.events.add(fixture.event)
    await database.draw_sessions.add({ ...fixture.session, status: 'pending-confirmation', configurationSnapshot: fixture.snapshots.configurationSnapshot, candidatePoolSnapshot: fixture.snapshots.candidatePoolSnapshot })
    await database.presentation_checkpoints.add(checkpointFromState({ drawSessionId: fixture.session.id, stage: 'pending-handoff', stageStartedAt: TIME_1, blackoutRequested: false }, TIME_1))

    await expect(assertParticipantMutationAllowed(database, fixture.event.id)).resolves.toBeUndefined()
  })
})
