import { describe, expect, it, vi } from 'vitest'
import type { DrawAuthoringDraft } from './draw-authoring.types.ts'
import type { DrawSetupQueryRepositories } from './draw-setup-query.types.ts'
import { queryDrawCapacityPreview } from './draw-capacity-preview-query.ts'

const timestamp = '2026-09-01T08:00:00.000Z'
const event = { id: 'event-1', name: 'Gala', status: 'ready', createdAt: timestamp, updatedAt: timestamp } as const
const categoryA = { id: 'category-a', eventId: event.id, name: 'Utama', prizeName: 'Mobil', displayOrder: 1, createdAt: timestamp } as const
const categoryB = { ...categoryA, id: 'category-b', name: 'Hiburan', prizeName: 'Voucher' } as const
const historicalConfiguration = { id: 'configuration-history', eventId: event.id, prizeCategoryId: categoryA.id, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, createdAt: timestamp, updatedAt: timestamp } as const
const historicalSession = { id: 'session-history', eventId: event.id, configurationId: historicalConfiguration.id, mode: 'live', status: 'completed', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: timestamp, updatedAt: timestamp } as const
const participants = [
  { id: 'participant-1', eventId: event.id, ticketNumber: '00001', isCheckedIn: true, group: 'VIP', createdAt: timestamp, updatedAt: timestamp },
  { id: 'participant-2', eventId: event.id, ticketNumber: '00002', isCheckedIn: false, group: 'REG', createdAt: timestamp, updatedAt: timestamp },
] as const
const confirmedWinner = { id: 'winner-1', eventId: event.id, prizeCategoryId: categoryA.id, drawSessionId: historicalSession.id, participantId: participants[0].id, ticketNumber: participants[0].ticketNumber, sequenceNumber: 1, status: 'confirmed', createdAt: timestamp, updatedAt: timestamp, confirmedAt: timestamp } as const

const baseDraft: DrawAuthoringDraft = {
  eventId: event.id,
  prizeCategoryId: categoryA.id,
  requestedWinners: '1',
  winningRule: 'once-per-event',
  requireCheckIn: false,
  eligibleGroupFilter: null,
  mode: 'live',
}

function repositories(selectedParticipants: readonly (typeof participants)[number][] = participants): DrawSetupQueryRepositories {
  return {
    events: { findById: vi.fn(async () => event) },
    preferences: { get: vi.fn(async () => event.id) },
    configurations: { findById: vi.fn(async () => historicalConfiguration), findByEventId: vi.fn(async () => [historicalConfiguration]) },
    categories: { findById: vi.fn(async () => categoryA), findByEventId: vi.fn(async () => [categoryA, categoryB]) },
    sessions: { findById: vi.fn(async () => historicalSession), findByEventId: vi.fn(async () => [historicalSession]) },
    participants: { countByEventId: vi.fn(async () => selectedParticipants.length), findByEventId: vi.fn(async (_eventId, page) => selectedParticipants.slice(page.offset, page.offset + page.limit)) },
    winners: { findByEventId: vi.fn(async () => [confirmedWinner]) },
  } as unknown as DrawSetupQueryRepositories
}

async function readyData(draft: DrawAuthoringDraft, selectedParticipants: readonly (typeof participants)[number][] = participants) {
  const result = await queryDrawCapacityPreview(draft, repositories(selectedParticipants))
  expect(result.state).toBe('ready')
  if (result.state !== 'ready') throw new Error(result.reason)
  return result.data
}

describe('queryDrawCapacityPreview', () => {
  it('re-evaluates current winning rule, category, check-in, group filter, and requested winners without saving', async () => {
    expect(await readyData(baseDraft)).toEqual({ totalParticipantCount: 2, checkedInParticipantCount: 1, previousWinnerExcludedCount: 1, eligibleParticipantCount: 1, requestedWinnerCount: 1 })
    expect(await readyData({ ...baseDraft, prizeCategoryId: categoryB.id, winningRule: 'once-per-category' })).toMatchObject({ previousWinnerExcludedCount: 0, eligibleParticipantCount: 2 })
    expect(await readyData({ ...baseDraft, winningRule: 'allow-repeat', requireCheckIn: true, requestedWinners: '6' })).toMatchObject({ previousWinnerExcludedCount: 0, eligibleParticipantCount: 1, requestedWinnerCount: 6 })
    expect(await readyData({ ...baseDraft, winningRule: 'allow-repeat', eligibleGroupFilter: 'TIDAK-ADA' })).toMatchObject({ eligibleParticipantCount: 0 })
  })

  it('returns numeric zeroes for a valid empty Event dataset', async () => {
    expect(await readyData(baseDraft, [])).toEqual({ totalParticipantCount: 0, checkedInParticipantCount: 0, previousWinnerExcludedCount: 0, eligibleParticipantCount: 0, requestedWinnerCount: 1 })
  })
})
