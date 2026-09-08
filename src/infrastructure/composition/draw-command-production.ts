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
import { executeDraw } from '../../application/draw/draw-command.ts'
import { DexieDrawPersistenceUnitOfWork } from '../persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import { createAuditRecordId, createWinnerRecordId } from '../../domain/shared/identifiers.ts'
import { DexiePresentationCheckpointRepository } from '../persistence/repositories/presentation-checkpoint.repository.ts'
import { DexieRedrawRepository } from '../persistence/repositories/redraw.repository.ts'
import { DexieRedrawRequestRepository } from '../persistence/repositories/redraw-request.repository.ts'
import { DexieAuditRepository } from '../persistence/repositories/audit.repository.ts'
import { DexieCommandReceiptRepository } from '../persistence/repositories/command-receipt.repository.ts'
import { ConfirmationService } from '../../application/pending-decisions/confirmation-service.ts'
import { CancellationService } from '../../application/pending-decisions/cancellation-service.ts'
import { RedrawService } from '../../application/pending-decisions/redraw-service.ts'
import { DexieDisplayConfigurationRepository } from '../persistence/repositories/display-configuration.repository.ts'
import { DexieEventSettingsRepository } from '../persistence/repositories/event-settings.repository.ts'
import { checkPersistenceHealth } from '../persistence/diagnostics/persistence-health.ts'

export function createDrawSetupProductionServices(): DrawSetupProductionServices {
  const database = new RaffleOSDatabase()
  const events = new DexieEventRepository(database)
  const configurations = new DexieDrawConfigurationRepository(database)
  const categories = new DexiePrizeCategoryRepository(database)
  const sessions = new DexieDrawSessionRepository(database)
  const participants = new DexieParticipantRepository(database)
  const preferences = new DexiePreferenceRepository(database)
  const displayConfigurations = new DexieDisplayConfigurationRepository(database)
  const eventSettings = new DexieEventSettingsRepository(database)
  const winners = new DexieWinnerRepository(database)
  const authoring = new DexieDrawAuthoringUnitOfWork(database)
  const persistence = new DexieDrawPersistenceUnitOfWork(database)
  const presentationCheckpoints = new DexiePresentationCheckpointRepository(database)
  const redraws = new DexieRedrawRepository(database)
  const redrawRequests = new DexieRedrawRequestRepository(database)
  const audits = new DexieAuditRepository(database)
  const receipts = new DexieCommandReceiptRepository(database)
  const repositories = { events, configurations, categories, sessions, participants, winners, authoring }
  const checkStorageHealth = async () => checkPersistenceHealth({ checkReadiness: () => database.checkReadiness() })
  return { ...repositories, audits, redraws, redrawRequests, preferences, displayConfigurations, eventSettings, presentationCheckpoints, authoringService: createDrawAuthoringService(repositories), open: async () => { await database.openSupported() }, checkStorage: async () => checkStorageHealth(), checkCrypto: async () => { try { createWebCryptoRandomSource(globalThis.crypto).nextUint32(); return { ok: true as const } } catch { return { ok: false as const, reason: 'Secure Web Crypto randomness is unavailable; this session cannot be handed off.' } } }, command: { execute: (input) => executeDraw(input, { ...repositories, checkStorageHealth, randomSource: createWebCryptoRandomSource(globalThis.crypto), persistence, now: () => new Date().toISOString() as import('../../domain/shared/timestamps.ts').IsoTimestamp, createWinnerRecordId, createAuditRecordId }) }, pendingDecisions: { confirmation: new ConfirmationService(persistence, receipts), cancellation: new CancellationService(persistence, receipts), redraw: new RedrawService(persistence, receipts), persistence, receipts } }
}
