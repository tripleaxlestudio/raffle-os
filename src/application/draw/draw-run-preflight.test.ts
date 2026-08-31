import { describe, expect, it } from 'vitest'
import { createDrawRunPreflight } from './draw-run-preflight.ts'
import type { DrawReadinessResult } from './draw-readiness.types.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'

const at = '2026-08-01T00:00:00.000Z' as IsoTimestamp

const ready = (overrides: Partial<NonNullable<DrawReadinessResult['data']>> = {}): DrawReadinessResult => ({
  state: 'ready', retryable: false,
  data: {
    event: { id: 'event' as never, name: 'Event', status: 'live', createdAt: at, updatedAt: at },
    category: { id: 'category' as never, eventId: 'event' as never, name: 'Prize', prizeName: 'Prize item', displayOrder: 1, createdAt: at },
    configuration: { id: 'configuration' as never, eventId: 'event' as never, prizeCategoryId: 'category' as never, requestedWinners: 1, winningRule: 'once-per-event', requireCheckIn: false, eligibleGroupFilter: null, presentation: { presentationMode: 'random-number-roll', rollStopMode: 'manual', rollDurationSeconds: 5, rollSpeedPerSecond: 12, revealMode: 'sequential' }, createdAt: at, updatedAt: at },
    session: { id: 'session' as never, eventId: 'event' as never, configurationId: 'configuration' as never, mode: 'practice', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: at, updatedAt: at },
    authoritativeEligibleCount: 100, totalParticipantCount: 120, checkedInParticipantCount: 100, previousWinnerExcludedCount: 0, requestedWinnerCount: 1, mode: 'practice', ...overrides,
  },
})

const display = { id: 'display' as never, eventId: 'event' as never, targetResolution: { width: 1920, height: 1080 }, safeAreaMargin: 24, blackoutAppearance: 'pure-black' as const, createdAt: at, updatedAt: at }

describe('Draw Run production preflight', () => {
  it('composes a complete ready checklist with Practice context and presentation summary', () => {
    const result = createDrawRunPreflight(ready(), display, 'connected')
    expect(result).toMatchObject({ state: 'ready', canStart: true, mode: 'practice' })
    expect(result.checks.map((check) => check.label)).toEqual(['Event', 'Prize', 'Pool yang memenuhi syarat', 'Audience Display', 'Presentasi', 'Session'])
    expect(result.checks.find((check) => check.key === 'eligibility')?.value).toBe('100 eligible')
    expect(result.checks.find((check) => check.key === 'presentation')?.value).toBe('Random Number Roll · Manual Stop')
  })

  it('blocks winner capacity and represents Live context', () => {
    const result = createDrawRunPreflight({ ...ready({ mode: 'live', session: { ...ready().data!.session, mode: 'live' } }), state: 'insufficient-capacity', reason: 'Reduce winners.' }, display, 'waiting')
    expect(result.canStart).toBe(false)
    expect(result.mode).toBe('live')
    expect(result.blocker?.key).toBe('eligibility')
  })

  it('makes missing DisplayConfiguration a setup-required hard blocker', () => {
    const result = createDrawRunPreflight(ready(), null, 'setup-required')
    const audience = result.checks.find((check) => check.key === 'audience')
    expect(result.canStart).toBe(false)
    expect(audience).toMatchObject({ state: 'blocked', value: 'Perlu pengaturan', recoveryPath: '/settings' })
  })

  it('distinguishes configured waiting, connected, and unavailable Audience states', () => {
    expect(createDrawRunPreflight(ready(), display, 'waiting').checks.find((check) => check.key === 'audience')).toMatchObject({ state: 'waiting', value: 'Waiting for Audience' })
    expect(createDrawRunPreflight(ready(), display, 'connected').checks.find((check) => check.key === 'audience')).toMatchObject({ state: 'ready', value: 'Terhubung' })
    expect(createDrawRunPreflight(ready(), display, 'unavailable').checks.find((check) => check.key === 'audience')).toMatchObject({ state: 'waiting', value: 'Tidak tersedia' })
  })

  it('keeps stale or conflicting sessions blocked without selecting winners', () => {
    const result = createDrawRunPreflight({ ...ready(), state: 'session-conflict', reason: 'Another Live draw is active.' }, display, 'connected')
    expect(result.canStart).toBe(false)
    expect(result.blocker?.key).toBe('session')
  })
})
