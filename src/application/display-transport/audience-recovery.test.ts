import { describe, expect, it } from 'vitest'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { EventSettings } from '../../domain/settings/event-settings.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import { projectPublicDisplaySnapshot } from './public-projection.ts'
import { projectAudienceRecoverySource } from './audience-recovery.ts'

const session = {
  id: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
  configurationId: '33333333-3333-4333-8333-333333333333',
  mode: 'live',
  status: 'pending-confirmation',
  configurationSnapshot: {
    snapshotFormatVersion: 1,
    configurationId: '33333333-3333-4333-8333-333333333333',
    prizeCategoryId: '44444444-4444-4444-8444-444444444444',
    categoryName: 'Grand Prize',
    prizeName: 'Electric Bike',
    requestedWinners: 2,
    winningRule: 'once-per-event',
    requireCheckIn: false,
    eligibleGroupFilter: null,
    capturedAt: '2026-08-28T00:00:00.000Z',
    presentation: {
      presentationMode: 'random-number-roll',
      rollStopMode: 'timed',
      rollDurationSeconds: 8,
      rollSpeedPerSecond: 12,
      revealMode: 'all-together',
    },
  },
  candidatePoolSnapshot: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:05.000Z',
} as unknown as DrawSession

const winner = (id: string, sequenceNumber: number, ticketNumber: string, status: WinnerRecord['status']): WinnerRecord => ({
  id: id as never,
  eventId: session.eventId,
  prizeCategoryId: session.configurationSnapshot!.prizeCategoryId,
  drawSessionId: session.id,
  participantId: `55555555-5555-4555-8555-55555555555${sequenceNumber}` as never,
  ticketNumber: ticketNumber as never,
  sequenceNumber,
  status,
  participantDisplayName: `Private participant ${sequenceNumber}`,
  createdAt: '2026-08-28T00:00:01.000Z' as never,
  updatedAt: '2026-08-28T00:00:02.000Z' as never,
})

const winners = [
  winner('66666666-6666-4666-8666-666666666661', 1, '00042', 'confirmed'),
  winner('66666666-6666-4666-8666-666666666662', 2, '42', 'pending'),
  winner('66666666-6666-4666-8666-666666666663', 3, '00999', 'cancelled'),
]

const eventSettings = {
  eventId: session.eventId,
  displayName: 'Recovery Gala',
  subtitle: 'Public subtitle',
  primaryColor: '#112233',
  accentColor: '#445566',
  presentation: {
    countdownDurationSeconds: 3,
    rollingDurationSeconds: 8,
    revealStyle: 'ticket-spotlight',
    celebrationEffect: 'confetti-burst',
    respectReducedMotion: true,
    winnerLayoutPreference: 'adaptive-operator-preview',
  },
  audioEnabled: false,
  masterVolume: 72,
  updatedAt: '2026-08-28T00:00:00.000Z',
} as EventSettings

const displayConfiguration = {
  id: '77777777-7777-4777-8777-777777777777',
  eventId: session.eventId,
  targetResolution: { width: 1920, height: 1080 },
  safeAreaMargin: 48,
  blackoutAppearance: 'pure-black',
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
} as unknown as DisplayConfiguration

function recovery(checkpoint: 'reveal' | 'countdown' | 'absent' = 'reveal') {
  return {
    kind: 'recover-session' as const,
    session,
    recommendedRoute: `/draw/pending/${session.id}`,
    decision: {
      kind: 'resume-verification' as const,
      session,
      winners,
      redraws: [],
      receipts: { kind: 'absent' as const },
      checkpoint: checkpoint === 'absent'
        ? { kind: 'absent' as const }
        : {
            kind: 'matching' as const,
            checkpoint: {
              drawSessionId: session.id,
              stage: checkpoint,
              stageStartedAt: '2026-08-28T00:00:03.000Z' as never,
              persistedAt: '2026-08-28T00:00:04.000Z' as never,
              presentationPolicyVersion: 1 as const,
              checkpointFormatVersion: 1 as const,
              blackoutRequested: checkpoint === 'reveal',
            },
          },
    },
  }
}

describe('Phase 10.6 authoritative Audience recovery projection', () => {
  it('restores the persisted reveal with exact public tickets, statuses, branding, and blackout intent', () => {
    const source = projectAudienceRecoverySource({ recovery: recovery(), eventSettings, displayConfiguration })
    expect(source).not.toBeNull()
    const snapshot = projectPublicDisplaySnapshot(source!)

    expect(snapshot).toMatchObject({
      drawSessionId: session.id,
      stage: 'reveal',
      stageStartedAt: '2026-08-28T00:00:03.000Z',
      blackoutRequested: true,
      eventName: 'Recovery Gala',
      eventSubtitle: 'Public subtitle',
      safeAreaMargin: 48,
      ticketNumbers: ['00042', '42'],
      winnerStatuses: ['confirmed', 'pending'],
      verificationState: 'in-progress',
    })
    expect(JSON.stringify(snapshot)).not.toContain('Private participant')
    expect(JSON.stringify(snapshot)).not.toContain('00999')
  })

  it('restores countdown metadata without exposing selected tickets before reveal', () => {
    const source = projectAudienceRecoverySource({ recovery: recovery('countdown'), eventSettings, displayConfiguration })
    const snapshot = projectPublicDisplaySnapshot(source!)

    expect(snapshot).toMatchObject({ stage: 'countdown', blackoutRequested: false })
    expect(snapshot.ticketNumbers).toBeUndefined()
    expect(snapshot.winnerStatuses).toBeUndefined()
  })

  it('falls back to authoritative pending handoff when no trusted checkpoint exists', () => {
    const source = projectAudienceRecoverySource({ recovery: recovery('absent'), eventSettings, displayConfiguration })
    expect(projectPublicDisplaySnapshot(source!)).toMatchObject({
      stage: 'pending-handoff',
      ticketNumbers: ['00042', '42'],
      winnerStatuses: ['confirmed', 'pending'],
    })
  })

  it('does not publish an ambiguous session that requires Operator acknowledgement', () => {
    const source = projectAudienceRecoverySource({
      recovery: {
        kind: 'recover-session',
        session,
        recommendedRoute: `/draw/pending/${session.id}`,
        decision: {
          kind: 'safe-acknowledgement-required',
          session,
          reason: 'selection-outcome-unknown',
          receipts: { kind: 'absent' },
          checkpoint: { kind: 'absent' },
        },
      },
      eventSettings,
      displayConfiguration,
    })

    expect(source).toBeNull()
  })
})
