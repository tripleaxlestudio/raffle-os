import { createEventSetupService } from '../../application/setup/event-setup-service.ts'
import { DexieEventRepository } from '../persistence/repositories/event.repository.ts'
import { DexiePrizeCategoryRepository } from '../persistence/repositories/prize-category.repository.ts'
import { DexiePreferenceRepository } from '../persistence/repositories/preference.repository.ts'
import { DexieParticipantRepository } from '../persistence/repositories/participant.repository.ts'
import { DexieDrawSessionRepository } from '../persistence/repositories/draw-session.repository.ts'
import { DexiePrizeImageAssetRepository } from '../persistence/repositories/prize-image-asset.repository.ts'
import { RaffleOSDatabase } from '../persistence/db.ts'

export function createEventSetupProductionServices(
  database = new RaffleOSDatabase(),
  prizeImages = new DexiePrizeImageAssetRepository(),
) {
  const services = {
    database,
    events: new DexieEventRepository(database),
    categories: new DexiePrizeCategoryRepository(database),
    preferences: new DexiePreferenceRepository(database),
    participants: new DexieParticipantRepository(database),
    sessions: new DexieDrawSessionRepository(database),
    prizeImages,
    open: async () => { await database.openSupported() },
  }
  return { ...services, service: createEventSetupService(services) }
}

export type EventSetupProductionServices = ReturnType<typeof createEventSetupProductionServices>
