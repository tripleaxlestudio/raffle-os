import { describe, expect, it } from 'vitest'
import { buildCandidatePool } from './candidate-pool-builder.ts'
import { executeDraw } from './draw-command.ts'
import { evaluateEligibility } from '../eligibility/eligibility-evaluator.ts'
import { selectWinners } from './winner-selection.ts'
import type { DrawConfigurationSnapshot, DrawSession } from '../../domain/draws/draw-session.types.ts'
import { createAuditRecordId, createDrawConfigurationId, createDrawSessionId, createEventId, createParticipantId, createPrizeCategoryId, createWinnerRecordId } from '../../domain/shared/identifiers.ts'
import { parseIsoTimestamp } from '../../domain/shared/timestamps.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { ParticipantRepository } from '../persistence/repositories/participant-repository.interface.ts'
import type { RandomSource } from './random-source.ts'

const at = parseIsoTimestamp('2026-08-01T00:00:00.000Z')
if (!at.ok) throw new Error(at.error.message)
const zeroRandom: RandomSource = { nextUint32: () => 0 }

describe('Phase 5 10,000-Participant performance evidence', () => {
  it('records deterministic algorithm timings without flaky thresholds', async () => {
    const event: Event = { id: createEventId(), name: 'Performance Event', status: 'ready', createdAt: at.value, updatedAt: at.value }
    const category: PrizeCategory = { id: createPrizeCategoryId(), eventId: event.id, name: 'Performance Prize', prizeName: 'Prize', displayOrder: 0, createdAt: at.value }
    const configuration: DrawConfiguration = { id: createDrawConfigurationId(), eventId: event.id, prizeCategoryId: category.id, requestedWinners: 100, winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: 'VIP', createdAt: at.value, updatedAt: at.value }
    const session: DrawSession = { id: createDrawSessionId(), eventId: event.id, configurationId: configuration.id, mode: 'live', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: at.value, updatedAt: at.value }
    const participants: Participant[] = Array.from({ length: 10_000 }, (_, index) => ({ id: createParticipantId(), eventId: event.id, ticketNumber: index === 0 ? '00042' as Participant['ticketNumber'] : index === 1 ? '42' as Participant['ticketNumber'] : `T${String(index).padStart(5, '0')}` as Participant['ticketNumber'], isCheckedIn: index % 3 !== 0, group: index % 4 === 0 ? 'VIP' : index % 4 === 1 ? 'Staff' : 'Public', createdAt: at.value, updatedAt: at.value }))
    const persistedParticipants = Object.freeze([...participants])
    const winners = Object.freeze([
      { id: createWinnerRecordId(), eventId: event.id, prizeCategoryId: category.id, drawSessionId: createDrawSessionId(), participantId: participants[4]!.id, ticketNumber: participants[4]!.ticketNumber, sequenceNumber: 1, status: 'confirmed' as const, confirmedAt: at.value, createdAt: at.value, updatedAt: at.value },
      { id: createWinnerRecordId(), eventId: event.id, prizeCategoryId: category.id, drawSessionId: createDrawSessionId(), participantId: participants[8]!.id, ticketNumber: participants[8]!.ticketNumber, sequenceNumber: 2, status: 'cancelled' as const, cancelledAt: at.value, createdAt: at.value, updatedAt: at.value },
    ])
    const repository: ParticipantRepository = { findById: async () => null, findByTicketNumber: async () => null, countByEventId: async () => persistedParticipants.length, findByEventId: async (_eventId, page) => persistedParticipants.slice(page.offset, page.offset + page.limit), createBatch: async () => undefined, updateOperationalFields: async () => undefined, deleteDraftEventParticipants: async () => undefined }
    const readRuns: number[] = []
    const eligibilityRuns: number[] = []
    const orderingRuns: number[] = []
    const snapshotRuns: number[] = []
    const selectionRuns: Record<number, number[]> = { 1: [], 20: [], 50: [], 100: [] }

    for (let run = 0; run < 4; run += 1) {
      const readStart = performance.now()
      const read = await repository.findByEventId(event.id, { limit: 10_000, offset: 0 })
      readRuns.push(performance.now() - readStart)
      const context = { activeEvent: event, drawConfiguration: configuration, prizeCategory: category, mode: 'live' as const, participants: read, winnerRecords: winners, ruleContext: { activeOfficialSessionIds: [], officialSessions: [] }, capturedAt: at.value }
      const eligibilityStart = performance.now()
      const eligibility = evaluateEligibility(context)
      eligibilityRuns.push(performance.now() - eligibilityStart)
      expect(eligibility.ok).toBe(true)
      const orderingStart = performance.now()
      const build = buildCandidatePool(context)
      orderingRuns.push(performance.now() - orderingStart)
      expect(build.ok).toBe(true)
      if (!build.ok) continue
      const snapshotStart = performance.now()
      expect(Object.isFrozen(build.value.snapshot)).toBe(true)
      snapshotRuns.push(performance.now() - snapshotStart)
      for (const count of [1, 20, 50, 100]) {
        const configurationSnapshot: DrawConfigurationSnapshot = Object.freeze({ snapshotFormatVersion: 1, configurationId: configuration.id, prizeCategoryId: category.id, categoryName: category.name, prizeName: category.prizeName, requestedWinners: count, winningRule: configuration.winningRule, requireCheckIn: configuration.requireCheckIn, eligibleGroupFilter: configuration.eligibleGroupFilter, capturedAt: at.value })
        const selectionStart = performance.now()
        const selection = selectWinners({ candidatePoolSnapshot: build.value.snapshot, configurationSnapshot, eventId: event.id, prizeCategoryId: category.id, mode: 'live', drawSessionId: session.id, at: at.value, randomSource: zeroRandom, createWinnerRecordId })
        selectionRuns[count].push(performance.now() - selectionStart)
        expect(selection.ok).toBe(true)
      }
    }

    const commandStart = performance.now()
    const result = await executeDraw({ eventId: event.id, drawSessionId: session.id, configurationId: configuration.id, prizeCategoryId: category.id, mode: 'live' }, {
      events: { findById: async () => event, findAll: async () => [event], create: async () => undefined, updateDraft: async () => undefined, transitionStatus: async () => undefined, deleteDraft: async () => undefined },
      configurations: { findById: async () => configuration, findByEventId: async () => [configuration], createDraft: async () => undefined, updateDraft: async () => undefined, deleteUnused: async () => undefined },
      categories: { findById: async () => category, findByEventId: async () => [category], create: async () => undefined, updateDraft: async () => undefined, deleteDraft: async () => undefined },
      sessions: { findById: async () => session, findByEventId: async () => [session], findLatestByEventId: async () => session, createDraft: async () => undefined, attachSnapshotsAndTransitionToDrawing: async () => undefined, transitionStatus: async () => undefined },
      participants: repository,
      winners: { findByEventId: async () => [], findByDrawSessionId: async () => [], findConfirmedByEventId: async () => [], findConfirmedByEventAndCategory: async () => [], append: async () => undefined, appendBatch: async () => undefined, transitionStatus: async () => undefined },
      persistence: { persistStartedDraw: async () => undefined, transitionWinnersWithAudit: async () => undefined, recordRedrawReplacement: async () => undefined },
      randomSource: zeroRandom, now: () => at.value, createWinnerRecordId, createAuditRecordId,
    })
    const commandTime = performance.now() - commandStart
    if (!result.ok) console.info('phase5-performance command failure', result.error)
    expect(result.ok).toBe(true)
    void commandTime
  })
})
