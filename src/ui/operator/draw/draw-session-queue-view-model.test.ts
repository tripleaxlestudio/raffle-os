import { describe, expect, it } from 'vitest'
import type { DrawSessionQueueItem } from '../../../application/draw/draw-session-queue.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { OperatorPublisherDiagnostics } from '../../../application/display-transport/operator-publisher.ts'
import { formatQueueTimestamp, groupDrawSessionQueueDecks, groupDrawSessionQueueItems, presentDrawSessionQueueItem, selectCurrentOperationalQueueItems } from './draw-session-queue-view-model.ts'
import { presentAudienceConnection } from './audience-connection-view-model.ts'

const event = { id: 'event', name: 'Event' } as Event
const category = { id: 'category', eventId: event.id, name: 'Gold', prizeName: 'Laptop' } as PrizeCategory
const session = (status: DrawSession['status'], mode: DrawSession['mode'] = 'live'): DrawSession => ({ id: `session-${status}-${mode}` as DrawSession['id'], eventId: event.id, configurationId: 'configuration' as DrawSession['configurationId'], mode, status, configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: '2026-08-06T00:00:00.000Z' as IsoTimestamp, updatedAt: '2026-08-06T16:42:00.000Z' as IsoTimestamp })
const item = (status: DrawSession['status'], mode: DrawSession['mode'] = 'live', relation: DrawSessionQueueItem['relation'] = 'valid'): DrawSessionQueueItem => ({ session: session(status, mode), event, category, winnerCount: 2, checkpoint: null, relation, action: relation === 'valid' ? status === 'pending-confirmation' ? { kind: 'pending', to: `/draw/pending/${session(status, mode).id}` } : status === 'ready' || status === 'drawing' ? { kind: 'run', to: `/draw/run/${session(status, mode).id}` } : { kind: 'history', to: '/history' } : null })

describe('production DrawSession queue view model', () => {
  it('formats timestamps without exposing ISO values', () => {
    const formatted = formatQueueTimestamp('2026-08-06T16:42:00.000Z')
    expect(formatted).toMatch(/^6 Aug 2026 · \d{2}:42$/)
    expect(formatted).not.toContain('T16:42:00')
  })
  it('uses explicit mode and lifecycle labels', () => {
    expect(presentDrawSessionQueueItem(item('ready', 'practice'))).toMatchObject({ modeLabel: 'Practice', lifecycleLabel: 'Ready', lifecycleTone: 'success', actionLabel: 'Start Practice' })
    expect(presentDrawSessionQueueItem(item('ready', 'live'))).toMatchObject({ modeLabel: 'Live', lifecycleLabel: 'Ready', actionLabel: 'Start Live' })
    expect(presentDrawSessionQueueItem(item('pending-confirmation'))).toMatchObject({ lifecycleLabel: 'Decision required', actionLabel: 'Review Pending Results', priority: 'action-required' })
  })
  it('formats drawing recovery without raw checkpoint values', () => {
    expect(presentDrawSessionQueueItem(item('drawing'))).toMatchObject({ lifecycleLabel: 'Presentation in progress', checkpointLabel: 'Presentation in progress; resume available', actionLabel: 'Resume presentation' })
    expect(presentDrawSessionQueueItem(item('drawing')).checkpointLabel).not.toBe('No checkpoint')
  })
  it('classifies completed and cancelled sessions as historical', () => {
    expect(presentDrawSessionQueueItem(item('completed'))).toMatchObject({ priority: 'historical', historical: true, lifecycleLabel: 'Completed' })
    expect(presentDrawSessionQueueItem(item('cancelled'))).toMatchObject({ priority: 'historical', historical: true, lifecycleLabel: 'Cancelled' })
    expect(groupDrawSessionQueueItems([item('pending-confirmation'), item('ready', 'practice'), item('completed'), item('cancelled')])['action-required']).toHaveLength(1)
  })
  it('keeps relationship failures visible and non-actionable', () => {
    expect(presentDrawSessionQueueItem(item('ready', 'live', 'missing-category'))).toMatchObject({ relationLabel: 'Prize category unavailable', actionLabel: null })
  })
  it('groups matching Practice and Live sessions into one draw deck', () => {
    const decks = groupDrawSessionQueueDecks([item('ready', 'practice'), item('ready', 'live')])
    expect(decks).toHaveLength(1)
    expect(decks[0]?.sessions.practice?.session.id).toBe('session-ready-practice')
    expect(decks[0]?.sessions.live?.session.id).toBe('session-ready-live')
    expect(decks[0]?.defaultMode).toBe('live')
  })
  it('selects one current operational draw and excludes completed previous draws', () => {
    const completed = item('completed')
    const next = { ...item('ready'), session: { ...item('ready').session, id: 'next-live' as DrawSession['id'], configurationId: 'next-configuration' as DrawSession['configurationId'], updatedAt: '2026-08-07T16:42:00.000Z' as IsoTimestamp } }
    const otherReady = { ...item('ready'), session: { ...item('ready').session, id: 'other-live' as DrawSession['id'], configurationId: 'other-configuration' as DrawSession['configurationId'] } }
    const selected = selectCurrentOperationalQueueItems([completed, otherReady, next])
    expect(selected.map((entry) => entry.session.id)).toEqual(['next-live'])
    expect(groupDrawSessionQueueDecks(selected)).toHaveLength(1)
  })

  it('keeps an active or pending Live draw ahead of newer ready sessions', () => {
    const ready = { ...item('ready'), session: { ...item('ready').session, id: 'newer-ready' as DrawSession['id'], configurationId: 'newer-configuration' as DrawSession['configurationId'], updatedAt: '2026-08-08T16:42:00.000Z' as IsoTimestamp } }
    const pending = { ...item('pending-confirmation'), session: { ...item('pending-confirmation').session, id: 'active-pending' as DrawSession['id'], configurationId: 'active-configuration' as DrawSession['configurationId'], updatedAt: '2026-08-06T16:42:00.000Z' as IsoTimestamp } }
    expect(selectCurrentOperationalQueueItems([ready, pending]).map((entry) => entry.session.id)).toEqual(['active-pending'])
  })
  it('distinguishes Audience presence from acknowledged publication', () => {
    expect(presentAudienceConnection({ kind: 'audience-presence', status: 'connected', subscriberCount: 1 }, undefined)).toMatchObject({ label: 'Waiting', acknowledged: false })
    expect(presentAudienceConnection({ kind: 'snapshot-applied', epoch: 1, sequence: 2, publicState: 'standby' }, { lastAcknowledgement: { epoch: 1, sequence: 2, publicState: 'standby' } } as unknown as OperatorPublisherDiagnostics)).toMatchObject({ label: 'Connected', acknowledged: true })
  })
})
