import { createAuditRecordId, createWinnerRecordId } from '../../domain/shared/identifiers.ts'
import { executeDraw } from '../../application/draw/draw-command.ts'
import { createWebCryptoRandomSource } from '../random/web-crypto-random-source.ts'
import { DexieDrawConfigurationRepository } from '../persistence/repositories/draw-configuration.repository.ts'
import { DexieDrawSessionRepository } from '../persistence/repositories/draw-session.repository.ts'
import { DexieEventRepository } from '../persistence/repositories/event.repository.ts'
import { DexieParticipantRepository } from '../persistence/repositories/participant.repository.ts'
import { DexiePrizeCategoryRepository } from '../persistence/repositories/prize-category.repository.ts'
import { DexiePreferenceRepository } from '../persistence/repositories/preference.repository.ts'
import { DexieWinnerRepository } from '../persistence/repositories/winner.repository.ts'
import { RaffleOSDatabase } from '../persistence/db.ts'
import { DexieDrawPersistenceUnitOfWork } from '../persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import type { DrawSetupProductionServices } from '../../application/draw/draw-setup-query.types.ts'

export function createDrawSetupProductionServices(): DrawSetupProductionServices {
  const database = new RaffleOSDatabase()
  const events = new DexieEventRepository(database)
  const configurations = new DexieDrawConfigurationRepository(database)
  const categories = new DexiePrizeCategoryRepository(database)
  const sessions = new DexieDrawSessionRepository(database)
  const participants = new DexieParticipantRepository(database)
  const preferences = new DexiePreferenceRepository(database)
  const winners = new DexieWinnerRepository(database)
  const persistence = new DexieDrawPersistenceUnitOfWork(database)
  const dependencies = { events, configurations, categories, sessions, participants, winners, persistence, randomSource: createWebCryptoRandomSource(), now: () => new Date().toISOString() as import('../../domain/shared/timestamps.ts').IsoTimestamp, createWinnerRecordId, createAuditRecordId, auditActor: { type: 'operator' as const, name: 'Operator' } }
  return { events, configurations, categories, sessions, participants, preferences, winners, open: async () => { await database.openSupported() }, command: { execute: (input) => executeDraw(input, dependencies) } }
}
