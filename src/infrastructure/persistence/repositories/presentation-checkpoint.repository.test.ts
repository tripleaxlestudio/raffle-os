import { describe, expect, it } from 'vitest'
import { createDrawSessionId } from '../../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../../domain/shared/timestamps.ts'
import { checkpointFromState } from '../../../domain/workflow/presentation-checkpoint.types.ts'
import { InvalidCheckpointError, RelationshipMismatchError } from '../errors/persistence-errors.ts'
import { cleanupTestDatabases, makeDrawHistoryFixture, openTestDatabase } from '../test/draw-history-test-helpers.ts'
import { DexiePresentationCheckpointRepository } from './presentation-checkpoint.repository.ts'

const time = parseIsoTimestamp('2026-08-05T01:00:00.000Z')
if (!time.ok) throw new Error(time.error.message)

describe('DexiePresentationCheckpointRepository', () => {
  it('round-trips, updates blackout independently, upserts idempotently, and deletes', async () => {
    const database = await openTestDatabase('presentation-checkpoint')
    try {
      const fixture = makeDrawHistoryFixture()
      await database.events.add(fixture.event)
      await database.draw_configurations.add(fixture.configuration)
      await database.draw_sessions.add(fixture.session)
      const repository = new DexiePresentationCheckpointRepository(database)
      const checkpoint = checkpointFromState({ stage: 'countdown', drawSessionId: fixture.session.id, stageStartedAt: time.value, blackoutRequested: false }, time.value)
      await repository.upsert(checkpoint)
      await repository.upsert({ ...checkpoint, blackoutRequested: true })
      expect(await repository.findByDrawSessionId(fixture.session.id)).toMatchObject({ stage: 'countdown', blackoutRequested: true })
      expect(await database.presentation_checkpoints.count()).toBe(1)
      await repository.upsert({ ...checkpoint, stage: 'reveal', blackoutRequested: true })
      expect(await repository.findByDrawSessionId(fixture.session.id)).toMatchObject({ stage: 'reveal', blackoutRequested: true })
      await repository.deleteByDrawSessionId(fixture.session.id)
      expect(await repository.findByDrawSessionId(fixture.session.id)).toBeNull()
    } finally { await cleanupTestDatabases() }
  })

  it('rejects non-Live or missing session relationships and invalid stored records', async () => {
    const database = await openTestDatabase('presentation-checkpoint-invalid')
    try {
      const fixture = makeDrawHistoryFixture()
      await database.events.add(fixture.event)
      await database.draw_configurations.add(fixture.configuration)
      await database.draw_sessions.add({ ...fixture.session, mode: 'practice' })
      const repository = new DexiePresentationCheckpointRepository(database)
      const checkpoint = checkpointFromState({ stage: 'rolling', drawSessionId: fixture.session.id, stageStartedAt: time.value, blackoutRequested: false }, time.value)
      await expect(repository.upsert(checkpoint)).rejects.toBeInstanceOf(RelationshipMismatchError)
      await expect(repository.findByDrawSessionId(createDrawSessionId())).resolves.toBeNull()
      await database.presentation_checkpoints.put({ ...checkpoint, stage: 'bad' as never })
      await expect(repository.findByDrawSessionId(fixture.session.id)).rejects.toBeInstanceOf(InvalidCheckpointError)
    } finally { await cleanupTestDatabases() }
  })
})
