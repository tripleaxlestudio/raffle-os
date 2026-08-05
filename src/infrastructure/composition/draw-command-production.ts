import { createDrawAuthoringService } from '../../application/draw/draw-authoring-service.ts'
import { DexieDrawConfigurationRepository } from '../persistence/repositories/draw-configuration.repository.ts'
import { DexieDrawSessionRepository } from '../persistence/repositories/draw-session.repository.ts'
import { DexieEventRepository } from '../persistence/repositories/event.repository.ts'
import { DexieParticipantRepository } from '../persistence/repositories/participant.repository.ts'
import { DexiePrizeCategoryRepository } from '../persistence/repositories/prize-category.repository.ts'
import { DexiePreferenceRepository } from '../persistence/repositories/preference.repository.ts'
import { DexieWinnerRepository } from '../persistence/repositories/winner.repository.ts'
import { RaffleOSDatabase } from '../persistence/db.ts'
import { DexieDrawAuthoringUnitOfWork } from '../persistence/transactions/dexie-draw-authoring-unit-of-work.ts'
import type { DrawSetupProductionServices } from '../../application/draw/draw-setup-query.types.ts'
import { createWebCryptoRandomSource } from '../random/web-crypto-random-source.ts'

export function createDrawSetupProductionServices(): DrawSetupProductionServices {
  const database = new RaffleOSDatabase()
  const events = new DexieEventRepository(database)
  const configurations = new DexieDrawConfigurationRepository(database)
  const categories = new DexiePrizeCategoryRepository(database)
  const sessions = new DexieDrawSessionRepository(database)
  const participants = new DexieParticipantRepository(database)
  const preferences = new DexiePreferenceRepository(database)
  const winners = new DexieWinnerRepository(database)
  const authoring = new DexieDrawAuthoringUnitOfWork(database)
  const repositories = { events, configurations, categories, sessions, participants, winners, authoring }
  return { ...repositories, preferences, authoringService: createDrawAuthoringService(repositories), open: async () => { await database.openSupported() }, checkStorage: () => database.checkReadiness(), checkCrypto: async () => { try { createWebCryptoRandomSource(globalThis.crypto).nextUint32(); return { ok: true as const } } catch { return { ok: false as const, reason: 'Secure Web Crypto randomness is unavailable; this session cannot be handed off.' } } } }
}
