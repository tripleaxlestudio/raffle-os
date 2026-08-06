import { describe, expect, it, vi } from 'vitest'
import { queryDrawSessionQueue } from './draw-session-queue.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { DrawSetupQueryRepositories } from './draw-setup-query.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

const event = { id: '00000000-0000-4000-8000-000000000001', name: 'Event A', status: 'live' } as Event
const otherEvent = { id: '00000000-0000-4000-8000-000000000002', name: 'Event B', status: 'live' } as Event
const category = { id: '00000000-0000-4000-8000-000000000003', eventId: event.id, name: 'Gold', prizeName: 'Laptop' } as PrizeCategory
const configuration = { id: '00000000-0000-4000-8000-000000000004', eventId: event.id, prizeCategoryId: category.id, requestedWinners: 2 } as DrawConfiguration
const session = (id: string, status: DrawSession['status'], mode: DrawSession['mode'] = 'live', updatedAt = '2026-08-06T00:00:00.000Z'): DrawSession => ({ id: id as DrawSession['id'], eventId: event.id, configurationId: configuration.id, mode, status, configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: updatedAt as IsoTimestamp, updatedAt: updatedAt as IsoTimestamp })

function repositories(sessions: DrawSession[]): DrawSetupQueryRepositories {
  return {
    events: { findById: vi.fn(async (id) => id === event.id ? event : null) },
    preferences: { get: vi.fn(async () => event.id) },
    configurations: { findById: vi.fn(async (id) => id === configuration.id ? configuration : null), findByEventId: vi.fn(async () => [configuration]) },
    categories: { findById: vi.fn(async (id) => id === category.id ? category : null), findByEventId: vi.fn(async () => [category]) },
    sessions: { findById: vi.fn(), findByEventId: vi.fn(async (id) => id === event.id ? sessions : []), findLatestByEventId: vi.fn(), createDraft: vi.fn(), attachSnapshotsAndTransitionToDrawing: vi.fn(), transitionStatus: vi.fn() },
    participants: { countByEventId: vi.fn(), findByEventId: vi.fn() },
    winners: { findByEventId: vi.fn(), findByDrawSessionId: vi.fn() },
  } as unknown as DrawSetupQueryRepositories
}

describe('DrawSession queue query', () => {
  it('scopes sessions to the selected Event and orders active, ready, then resolved', async () => {
    const ready = session('00000000-0000-4000-8000-000000000005', 'ready', 'practice', '2026-08-05T00:00:00.000Z')
    const pending = session('00000000-0000-4000-8000-000000000006', 'pending-confirmation')
    const completed = session('00000000-0000-4000-8000-000000000007', 'completed', 'live', '2026-08-06T01:00:00.000Z')
    const result = await queryDrawSessionQueue(event.id, repositories([completed, ready, pending]))
    expect(result?.items.map((item) => item.session.status)).toEqual(['pending-confirmation', 'ready', 'completed'])
    expect(result?.items[0]?.action).toEqual({ kind: 'pending', to: `/draw/pending/${pending.id}` })
    expect(result?.items[1]?.action).toEqual({ kind: 'run', to: `/draw/run/${ready.id}` })
    expect(result?.items[2]?.action).toEqual({ kind: 'history', to: '/history' })
  })

  it('returns no queue for a missing Event and blocks missing relations', async () => {
    expect(await queryDrawSessionQueue(otherEvent.id, repositories([]))).toBeNull()
    const missing = session('00000000-0000-4000-8000-000000000008', 'ready')
    const repos = repositories([missing])
    repos.configurations.findById = vi.fn(async () => null)
    const result = await queryDrawSessionQueue(event.id, repos)
    expect(result?.items[0]?.relation).toBe('missing-configuration')
    expect(result?.items[0]?.action).toBeNull()
  })
})
