import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { createAuditRecordId, createDisplayConfigurationId, createWinnerRecordId, type CommandId } from '../../domain/shared/identifiers.ts'
import { DEFAULT_PRESENTATION_SETTINGS } from '../../domain/settings/presentation-settings.types.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { EventSettings } from '../../domain/settings/event-settings.types.ts'
import { executeDraw } from '../draw/draw-command.ts'
import type { DrawCommandDependencies } from '../draw/draw-command.types.ts'
import { createAudienceController } from '../display-transport/audience-controller.ts'
import { projectAudienceRecoverySource } from '../display-transport/audience-recovery.ts'
import { createOperatorPublisher } from '../display-transport/operator-publisher.ts'
import { createInMemoryTransportPair } from '../display-transport/transport.ts'
import { ConfirmationService } from '../pending-decisions/confirmation-service.ts'
import type { ConfirmPendingWinnersCommand } from '../pending-decisions/command.types.ts'
import { StartupRecoveryGate } from '../../app/workspace/StartupRecoveryGate.tsx'
import { DexieDrawConfigurationRepository } from '../../infrastructure/persistence/repositories/draw-configuration.repository.ts'
import { DexieDrawSessionRepository } from '../../infrastructure/persistence/repositories/draw-session.repository.ts'
import { DexieEventRepository } from '../../infrastructure/persistence/repositories/event.repository.ts'
import { DexieParticipantRepository } from '../../infrastructure/persistence/repositories/participant.repository.ts'
import { DexiePreferenceRepository } from '../../infrastructure/persistence/repositories/preference.repository.ts'
import { DexiePrizeCategoryRepository } from '../../infrastructure/persistence/repositories/prize-category.repository.ts'
import { DexieWinnerRepository } from '../../infrastructure/persistence/repositories/winner.repository.ts'
import { DexieRedrawRepository } from '../../infrastructure/persistence/repositories/redraw.repository.ts'
import { DexiePresentationCheckpointRepository } from '../../infrastructure/persistence/repositories/presentation-checkpoint.repository.ts'
import { DexieCommandReceiptRepository } from '../../infrastructure/persistence/repositories/command-receipt.repository.ts'
import { DexieDrawPersistenceUnitOfWork } from '../../infrastructure/persistence/transactions/dexie-draw-persistence-unit-of-work.ts'
import type { RaffleOSDatabase } from '../../infrastructure/persistence/db.ts'
import {
  cleanupTestDatabases,
  makeDrawHistoryFixture,
  makeWinner,
  openTestDatabase,
  seedReadyFixture,
  seedStartedFixture,
  TIME_1,
  TIME_3,
} from '../../infrastructure/persistence/test/draw-history-test-helpers.ts'
import { resolveStartupRecovery, type StartupRecoveryServices } from './startup-recovery-service.ts'

afterEach(cleanupTestDatabases)

function recoveryServices(database: RaffleOSDatabase): StartupRecoveryServices {
  return {
    open: async () => { await database.openSupported() },
    checkStorage: () => database.checkReadiness(),
    preferences: new DexiePreferenceRepository(database),
    events: new DexieEventRepository(database),
    sessions: new DexieDrawSessionRepository(database),
    winners: new DexieWinnerRepository(database),
    redraws: new DexieRedrawRepository(database),
    receipts: new DexieCommandReceiptRepository(database),
    presentationCheckpoints: new DexiePresentationCheckpointRepository(database),
  }
}

function drawDependencies(database: RaffleOSDatabase): DrawCommandDependencies {
  return {
    events: new DexieEventRepository(database),
    configurations: new DexieDrawConfigurationRepository(database),
    categories: new DexiePrizeCategoryRepository(database),
    sessions: new DexieDrawSessionRepository(database),
    participants: new DexieParticipantRepository(database),
    winners: new DexieWinnerRepository(database),
    randomSource: { nextUint32: () => 0 },
    persistence: new DexieDrawPersistenceUnitOfWork(database),
    now: () => TIME_3,
    createWinnerRecordId,
    createAuditRecordId,
  }
}

async function setActiveEvent(database: RaffleOSDatabase, eventId: ReturnType<typeof makeDrawHistoryFixture>['event']['id']): Promise<void> {
  await new DexiePreferenceRepository(database).set('activeEventId', eventId, TIME_1)
}

async function executeFixtureDraw(database: RaffleOSDatabase, fixture: ReturnType<typeof makeDrawHistoryFixture>) {
  return executeDraw({
    eventId: fixture.event.id,
    drawSessionId: fixture.session.id,
    configurationId: fixture.configuration.id,
    prizeCategoryId: fixture.category.id,
    mode: 'live',
  }, drawDependencies(database))
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

describe('Phase 10.7 integrated recovery acceptance scenarios A-I', () => {
  it('A: refresh with no unresolved draw returns normally without creating official records', async () => {
    const database = await openTestDatabase('phase10-scenario-a')
    const fixture = makeDrawHistoryFixture()
    await seedReadyFixture(database, fixture)
    await setActiveEvent(database, fixture.event.id)
    const before = await Promise.all([database.draw_sessions.count(), database.winner_records.count(), database.audit_records.count()])

    await expect(resolveStartupRecovery(recoveryServices(database))).resolves.toEqual({ kind: 'normal', targetPath: '/dashboard' })
    expect(await Promise.all([database.draw_sessions.count(), database.winner_records.count(), database.audit_records.count()])).toEqual(before)
  })

  it('B: refresh after persisted Live selection restores exact identities, tickets, snapshots, and Pending state', async () => {
    const database = await openTestDatabase('phase10-scenario-b')
    const fixture = makeDrawHistoryFixture(['00042', '42'])
    await seedReadyFixture(database, fixture)
    await setActiveEvent(database, fixture.event.id)
    const draw = await executeFixtureDraw(database, fixture)
    expect(draw.ok).toBe(true)
    if (!draw.ok) return

    const recovery = await resolveStartupRecovery(recoveryServices(database))
    expect(recovery).toMatchObject({
      kind: 'recover-session',
      session: { id: fixture.session.id, status: 'pending-confirmation' },
      recommendedRoute: `/draw/pending/${fixture.session.id}`,
      decision: {
        kind: 'resume-verification',
        winners: draw.value.pendingWinners,
      },
    })
    if (recovery.kind !== 'recover-session') return
    expect(recovery.session.configurationSnapshot).toEqual(draw.value.configurationSnapshot)
    expect(recovery.session.candidatePoolSnapshot).toEqual(draw.value.candidatePoolSnapshot)
    expect(recovery.decision.kind === 'resume-verification' && recovery.decision.winners.map((winner) => winner.ticketNumber)).toEqual(['42', '00042'])
  })

  it('C: refresh after partial confirmation preserves the Confirmed/Pending split and receipt evidence', async () => {
    const database = await openTestDatabase('phase10-scenario-c')
    const fixture = makeDrawHistoryFixture(['00042', '00043'])
    await seedStartedFixture(database, fixture)
    await setActiveEvent(database, fixture.event.id)
    const first = makeWinner(fixture, 0, 1)
    const second = makeWinner(fixture, 1, 2)
    await database.winner_records.bulkAdd([first, second])
    const persistence = new DexieDrawPersistenceUnitOfWork(database)
    const receipts = new DexieCommandReceiptRepository(database)
    const service = new ConfirmationService(persistence, receipts)
    const command: ConfirmPendingWinnersCommand = {
      actor: 'local-operator',
      commandId: crypto.randomUUID() as CommandId,
      drawSessionId: fixture.session.id,
      mode: 'live',
      operation: 'confirm-pending-winners',
      targets: [{ winnerId: first.id, expectedStatus: 'pending' }],
    }
    expect((await service.confirm(command)).status).toBe('committed')

    const before = await Promise.all([database.audit_records.count(), database.command_receipts.count()])
    const recovery = await resolveStartupRecovery(recoveryServices(database))
    expect(recovery.kind === 'recover-session' && recovery.decision.kind === 'resume-verification'
      ? recovery.decision.winners.map(({ id, status, ticketNumber }) => ({ id, status, ticketNumber }))
      : []).toEqual([
      { id: first.id, status: 'confirmed', ticketNumber: '00042' },
      { id: second.id, status: 'pending', ticketNumber: '00043' },
    ])
    expect(await Promise.all([database.audit_records.count(), database.command_receipts.count()])).toEqual(before)
  })

  it('D: interruption before selection requires acknowledgement and never fabricates a winner', async () => {
    const database = await openTestDatabase('phase10-scenario-d')
    const fixture = makeDrawHistoryFixture()
    await seedStartedFixture(database, fixture, 'drawing')
    await setActiveEvent(database, fixture.event.id)

    await expect(resolveStartupRecovery(recoveryServices(database))).resolves.toMatchObject({
      kind: 'recover-session',
      recommendedRoute: `/draw/pending/${fixture.session.id}`,
      decision: { kind: 'safe-acknowledgement-required', reason: 'selection-outcome-unknown' },
    })
    expect(await database.winner_records.count()).toBe(0)
    expect(await database.audit_records.count()).toBe(0)
  })

  it('E: Audience reconnect restores only the authoritative persisted public result', async () => {
    const database = await openTestDatabase('phase10-scenario-e')
    const fixture = makeDrawHistoryFixture(['00042', '42'])
    await seedReadyFixture(database, fixture)
    await setActiveEvent(database, fixture.event.id)
    expect((await executeFixtureDraw(database, fixture)).ok).toBe(true)
    const recovery = await resolveStartupRecovery(recoveryServices(database))
    const displayConfiguration: DisplayConfiguration = {
      id: createDisplayConfigurationId(),
      eventId: fixture.event.id,
      targetResolution: { width: 1920, height: 1080 },
      safeAreaMargin: 48,
      blackoutAppearance: 'pure-black',
      createdAt: TIME_1,
      updatedAt: TIME_1,
    }
    const eventSettings: EventSettings = {
      eventId: fixture.event.id,
      displayName: fixture.event.name,
      subtitle: 'Recovery acceptance',
      primaryColor: '#112233',
      accentColor: '#445566',
      presentation: DEFAULT_PRESENTATION_SETTINGS,
      audioEnabled: false,
      masterVolume: 72,
      updatedAt: TIME_1,
    }
    const source = projectAudienceRecoverySource({ recovery, eventSettings, displayConfiguration })
    expect(source).not.toBeNull()
    if (source === null) return

    const channel = `phase10-scenario-e-${crypto.randomUUID()}`
    const [operatorTransport, firstAudienceTransport] = createInMemoryTransportPair(channel)
    const scope = { eventId: fixture.event.id, displayId: displayConfiguration.id }
    const publisher = createOperatorPublisher({
      transport: operatorTransport,
      scope,
      senderId: 'phase10-acceptance-operator',
      clock: { now: () => TIME_3 },
      heartbeatIntervalMs: 0,
    })
    publisher.start(source)
    const firstAudience = createAudienceController({ transport: firstAudienceTransport, scope })
    expect(firstAudience.getState()).toMatchObject({ snapshot: { drawSessionId: fixture.session.id, ticketNumbers: ['42', '00042'] } })
    firstAudience.close()

    const [, reconnectedTransport] = createInMemoryTransportPair(channel)
    const reconnectedAudience = createAudienceController({ transport: reconnectedTransport, scope })
    expect(reconnectedAudience.getState()).toMatchObject({
      kind: 'snapshot',
      snapshot: { drawSessionId: fixture.session.id, stage: 'pending-handoff', ticketNumbers: ['42', '00042'] },
    })
    expect(await database.winner_records.count()).toBe(2)

    reconnectedAudience.close()
    publisher.close()
    reconnectedTransport.close()
    operatorTransport.close()
  })

  it('F: failed official persistence is rolled back and cannot report a recoverable result', async () => {
    const database = await openTestDatabase('phase10-scenario-f')
    const fixture = makeDrawHistoryFixture(['00042', '00043'])
    await seedReadyFixture(database, fixture)
    await setActiveEvent(database, fixture.event.id)
    vi.spyOn(database.audit_records, 'add').mockRejectedValueOnce(new Error('injected official write failure'))

    const result = await executeFixtureDraw(database, fixture)
    expect(result).toMatchObject({ ok: false, error: { kind: 'persistence', code: 'persistence-failed' } })
    expect((await database.draw_sessions.get(fixture.session.id))?.status).toBe('ready')
    expect(await Promise.all([database.winner_records.count(), database.audit_records.count(), database.command_receipts.count()])).toEqual([0, 0, 0])
    await expect(resolveStartupRecovery(recoveryServices(database))).resolves.toEqual({ kind: 'normal', targetPath: '/dashboard' })
  })

  it('G: unsafe storage/schema readiness blocks startup before authoritative repositories are read', async () => {
    const findActiveEvent = vi.fn(async () => null)
    const services = {
      checkStorage: vi.fn(async () => ({ ok: false as const, code: 'unsupported-schema', reason: 'The stored schema is newer than this application.' })),
      open: vi.fn(async () => undefined),
      preferences: { get: findActiveEvent },
      events: { findById: vi.fn(async () => null) },
      sessions: { findByEventId: vi.fn(async () => []) },
      winners: { findByEventId: vi.fn(async () => []) },
    } as unknown as StartupRecoveryServices

    await expect(resolveStartupRecovery(services)).resolves.toEqual({
      kind: 'storage-failure',
      error: 'The stored schema is newer than this application.',
    })
    expect(findActiveEvent).not.toHaveBeenCalled()
    expect(services.open).not.toHaveBeenCalled()
  })

  it('H: unresolved official work redirects the Operator away from conflicting fresh setup', async () => {
    const database = await openTestDatabase('phase10-scenario-h')
    const fixture = makeDrawHistoryFixture(['00042', '00043'])
    await seedStartedFixture(database, fixture)
    await setActiveEvent(database, fixture.event.id)
    await database.winner_records.bulkAdd([makeWinner(fixture, 0, 1), makeWinner(fixture, 1, 2)])
    const recovery = await resolveStartupRecovery(recoveryServices(database))

    render(
      <MemoryRouter initialEntries={['/draw/setup']}>
        <StartupRecoveryGate recovery={recovery} />
        <LocationProbe />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`/draw/pending/${fixture.session.id}`))
    expect(screen.getByText('The authoritative session was preserved. No new selection will be made during recovery.')).toBeVisible()
  })

  it('I: repeated recovery and duplicate command replay remain idempotent', async () => {
    const database = await openTestDatabase('phase10-scenario-i')
    const fixture = makeDrawHistoryFixture(['00042', '00043'])
    await seedStartedFixture(database, fixture)
    await setActiveEvent(database, fixture.event.id)
    const first = makeWinner(fixture, 0, 1)
    const second = makeWinner(fixture, 1, 2)
    await database.winner_records.bulkAdd([first, second])
    const service = new ConfirmationService(new DexieDrawPersistenceUnitOfWork(database), new DexieCommandReceiptRepository(database))
    const command: ConfirmPendingWinnersCommand = {
      actor: 'local-operator',
      commandId: crypto.randomUUID() as CommandId,
      drawSessionId: fixture.session.id,
      mode: 'live',
      operation: 'confirm-pending-winners',
      targets: [{ winnerId: first.id, expectedStatus: 'pending' }],
    }
    expect((await service.confirm(command)).status).toBe('committed')
    expect((await service.confirm(command)).status).toBe('idempotent-replay')
    const counts = await Promise.all([
      database.draw_sessions.count(),
      database.winner_records.count(),
      database.audit_records.count(),
      database.command_receipts.count(),
    ])

    const decisions = await Promise.all(Array.from({ length: 3 }, () => resolveStartupRecovery(recoveryServices(database))))
    expect(decisions[1]).toEqual(decisions[0])
    expect(decisions[2]).toEqual(decisions[0])
    expect(await Promise.all([
      database.draw_sessions.count(),
      database.winner_records.count(),
      database.audit_records.count(),
      database.command_receipts.count(),
    ])).toEqual(counts)
    expect(counts).toEqual([1, 2, 1, 1])
  })
})
