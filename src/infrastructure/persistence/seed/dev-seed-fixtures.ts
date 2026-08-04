import type { AuditRecord } from '../../../domain/audit/audit.types.ts'
import type { DisplayConfiguration } from '../../../domain/display/display-configuration.types.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import type { Participant } from '../../../domain/participants/participant.types.ts'
import type { ApplicationPreference } from '../../../domain/preferences/application-preference.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import type {
  AuditRecordId,
  DisplayConfigurationId,
  DrawConfigurationId,
  DrawSessionId,
  EventId,
  ParticipantId,
  PrizeCategoryId,
  RedrawRecordId,
  WinnerRecordId,
} from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { RedrawRecord } from '../../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../../domain/winners/winner.types.ts'

export const SEED_ISO_TIMESTAMPS = {
  t0: '2026-07-31T08:00:00.000Z' as IsoTimestamp,
  t1: '2026-07-31T08:15:00.000Z' as IsoTimestamp,
  t2: '2026-07-31T08:30:00.000Z' as IsoTimestamp,
  t3: '2026-07-31T08:45:00.000Z' as IsoTimestamp,
  t4: '2026-07-31T09:00:00.000Z' as IsoTimestamp,
} as const

export const SEED_EVENT_IDS = {
  draft: '11111111-1111-4111-8111-111111111111' as EventId,
  history: '22222222-2222-4222-8222-222222222222' as EventId,
  acceptance: 'aaaaaaa5-0000-4000-8000-000000000001' as EventId,
} as const

export const SEED_PRIZE_CATEGORY_IDS = {
  door: '33333333-3333-4333-8333-333333333332' as PrizeCategoryId,
  grand: '33333333-3333-4333-8333-333333333331' as PrizeCategoryId,
} as const

export const SEED_DRAW_CONFIG_ID =
  '44444444-4444-4444-8444-444444444444' as DrawConfigurationId

export const SEED_DISPLAY_CONFIG_IDS = {
  draft: '55555555-5555-4555-8555-555555555551' as DisplayConfigurationId,
  history: '55555555-5555-4555-8555-555555555552' as DisplayConfigurationId,
} as const

export const SEED_DRAW_SESSION_ID =
  '77777777-7777-4777-8777-777777777777' as DrawSessionId

export const ACCEPTANCE_SEED_IDS = {
  category: 'aaaaaaa5-0000-4000-8000-000000000002' as PrizeCategoryId,
  configuration: 'aaaaaaa5-0000-4000-8000-000000000003' as DrawConfigurationId,
  practiceSession: 'aaaaaaa5-0000-4000-8000-000000000004' as DrawSessionId,
  liveSession: 'aaaaaaa5-0000-4000-8000-000000000005' as DrawSessionId,
} as const

export const SEED_WINNER_RECORD_IDS = {
  w1: '88888888-8888-4888-8888-888888888881' as WinnerRecordId,
  w2: '88888888-8888-4888-8888-888888888882' as WinnerRecordId,
  w3: '88888888-8888-4888-8888-888888888883' as WinnerRecordId,
} as const

export const SEED_REDRAW_RECORD_ID =
  '99999999-9999-4999-8999-999999999999' as RedrawRecordId

export const SEED_AUDIT_RECORD_IDS = {
  a1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' as AuditRecordId,
  a2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2' as AuditRecordId,
} as const

export function getStandardSeedEvents(): Event[] {
  return [
    {
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      description: 'Development sandbox event in draft state',
      id: SEED_EVENT_IDS.draft,
      name: 'Raffle OS Dev Draft Gala',
      status: 'draft',
      updatedAt: SEED_ISO_TIMESTAMPS.t0,
    },
    {
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      description: 'Development event with historical draw records',
      id: SEED_EVENT_IDS.history,
      name: 'Raffle OS Dev History Event',
      status: 'live',
      updatedAt: SEED_ISO_TIMESTAMPS.t1,
    },
  ]
}

export function getStandardSeedPrizeCategories(): PrizeCategory[] {
  return [
    {
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      description: 'Top prize category',
      displayOrder: 1,
      eventId: SEED_EVENT_IDS.history,
      id: SEED_PRIZE_CATEGORY_IDS.grand,
      name: 'Grand Prize',
      prizeName: 'Luxury Electric Vehicle',
      sponsorName: 'Tech Auto Sponsor',
    },
    {
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      description: 'Secondary door prize category',
      displayOrder: 2,
      eventId: SEED_EVENT_IDS.history,
      id: SEED_PRIZE_CATEGORY_IDS.door,
      name: 'Door Prize',
      prizeName: 'Smart Watch',
      sponsorName: undefined,
    },
  ]
}

export function getStandardSeedDrawConfigurations(): DrawConfiguration[] {
  return [
    {
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      eligibleGroupFilter: null,
      eventId: SEED_EVENT_IDS.history,
      id: SEED_DRAW_CONFIG_ID,
      prizeCategoryId: SEED_PRIZE_CATEGORY_IDS.grand,
      requestedWinners: 2,
      requireCheckIn: true,
      updatedAt: SEED_ISO_TIMESTAMPS.t0,
      winningRule: 'once-per-event',
    },
  ]
}

export function getStandardSeedDisplayConfigurations(): DisplayConfiguration[] {
  return [
    {
      blackoutAppearance: 'pure-black',
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      eventId: SEED_EVENT_IDS.draft,
      id: SEED_DISPLAY_CONFIG_IDS.draft,
      safeAreaMargin: 24,
      targetResolution: { height: 1080, width: 1920 },
      updatedAt: SEED_ISO_TIMESTAMPS.t0,
    },
    {
      blackoutAppearance: 'pure-black',
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      eventId: SEED_EVENT_IDS.history,
      id: SEED_DISPLAY_CONFIG_IDS.history,
      safeAreaMargin: 24,
      targetResolution: { height: 1080, width: 1920 },
      updatedAt: SEED_ISO_TIMESTAMPS.t0,
    },
  ]
}

export function getStandardSeedParticipants(): Participant[] {
  const participants: Participant[] = []
  for (let index = 1; index <= 20; index++) {
    const paddedIndex = index.toString().padStart(12, '0')
    const ticketNumber = index.toString().padStart(6, '0') as Participant['ticketNumber']
    participants.push({
      createdAt: SEED_ISO_TIMESTAMPS.t0,
      eventId: SEED_EVENT_IDS.history,
      group: index <= 10 ? 'VIP' : 'General',
      id: `66666666-6666-4666-8666-${paddedIndex}` as ParticipantId,
      isCheckedIn: true,
      name: `Participant ${index}`,
      notes: undefined,
      ticketNumber,
      updatedAt: SEED_ISO_TIMESTAMPS.t0,
    })
  }
  return participants
}

export function getStandardSeedDrawSession(): DrawSession {
  const participants = getStandardSeedParticipants()
  return {
    candidatePoolSnapshot: {
      candidateEntries: participants.map((participant) => ({
        participantId: participant.id,
        ticketNumber: participant.ticketNumber,
      })),
      capturedAt: SEED_ISO_TIMESTAMPS.t1,
      configurationId: SEED_DRAW_CONFIG_ID,
      eventId: SEED_EVENT_IDS.history,
      eligibleGroupFilter: null,
      eligibleSnapshotCount: participants.length,
      mode: 'live',
      prizeCategoryId: SEED_PRIZE_CATEGORY_IDS.grand,
      requireCheckIn: true,
      snapshotFormatVersion: 1,
      winningRule: 'once-per-event',
    },
    completedAt: SEED_ISO_TIMESTAMPS.t4,
    configurationId: SEED_DRAW_CONFIG_ID,
    configurationSnapshot: {
      capturedAt: SEED_ISO_TIMESTAMPS.t1,
      categoryName: 'Grand Prize',
      configurationId: SEED_DRAW_CONFIG_ID,
      eligibleGroupFilter: null,
      prizeCategoryId: SEED_PRIZE_CATEGORY_IDS.grand,
      prizeName: 'Luxury Electric Vehicle',
      requestedWinners: 2,
      requireCheckIn: true,
      snapshotFormatVersion: 1,
      winningRule: 'once-per-event',
    },
    createdAt: SEED_ISO_TIMESTAMPS.t1,
    eventId: SEED_EVENT_IDS.history,
    id: SEED_DRAW_SESSION_ID,
    mode: 'live',
    status: 'completed',
    updatedAt: SEED_ISO_TIMESTAMPS.t4,
  }
}

export function getStandardSeedWinners(): WinnerRecord[] {
  const participants = getStandardSeedParticipants()
  return [
    {
      cancelledAt: undefined,
      confirmedAt: SEED_ISO_TIMESTAMPS.t3,
      createdAt: SEED_ISO_TIMESTAMPS.t2,
      drawSessionId: SEED_DRAW_SESSION_ID,
      eventId: SEED_EVENT_IDS.history,
      id: SEED_WINNER_RECORD_IDS.w1,
      participantId: participants[0].id,
      prizeCategoryId: SEED_PRIZE_CATEGORY_IDS.grand,
      sequenceNumber: 1,
      status: 'confirmed',
      ticketNumber: participants[0].ticketNumber,
      updatedAt: SEED_ISO_TIMESTAMPS.t3,
    },
    {
      cancelledAt: SEED_ISO_TIMESTAMPS.t3,
      confirmedAt: undefined,
      createdAt: SEED_ISO_TIMESTAMPS.t2,
      drawSessionId: SEED_DRAW_SESSION_ID,
      eventId: SEED_EVENT_IDS.history,
      id: SEED_WINNER_RECORD_IDS.w2,
      participantId: participants[1].id,
      prizeCategoryId: SEED_PRIZE_CATEGORY_IDS.grand,
      sequenceNumber: 2,
      status: 'cancelled',
      ticketNumber: participants[1].ticketNumber,
      updatedAt: SEED_ISO_TIMESTAMPS.t3,
    },
    {
      cancelledAt: undefined,
      confirmedAt: undefined,
      createdAt: SEED_ISO_TIMESTAMPS.t3,
      drawSessionId: SEED_DRAW_SESSION_ID,
      eventId: SEED_EVENT_IDS.history,
      id: SEED_WINNER_RECORD_IDS.w3,
      participantId: participants[2].id,
      prizeCategoryId: SEED_PRIZE_CATEGORY_IDS.grand,
      sequenceNumber: 3,
      status: 'pending',
      ticketNumber: participants[2].ticketNumber,
      updatedAt: SEED_ISO_TIMESTAMPS.t3,
    },
  ]
}

export function getStandardSeedRedrawRecord(): RedrawRecord {
  return {
    createdAt: SEED_ISO_TIMESTAMPS.t3,
    drawSessionId: SEED_DRAW_SESSION_ID,
    eventId: SEED_EVENT_IDS.history,
    id: SEED_REDRAW_RECORD_ID,
    originalWinnerRecordId: SEED_WINNER_RECORD_IDS.w2,
    reason: 'absent',
    reasonNote: undefined,
    replacementWinnerRecordId: SEED_WINNER_RECORD_IDS.w3,
  }
}

export function getStandardSeedAuditRecords(): AuditRecord[] {
  return [
    {
      action: 'draw-session-started',
      actor: { name: 'Dev Operator', type: 'operator' },
      detail: { mode: 'live', requestedWinners: 2 },
      eventId: SEED_EVENT_IDS.history,
      id: SEED_AUDIT_RECORD_IDS.a1,
      timestamp: SEED_ISO_TIMESTAMPS.t1,
    },
    {
      action: 'redraw-recorded',
      actor: { name: 'Dev Operator', type: 'operator' },
      detail: {
        originalWinnerId: SEED_WINNER_RECORD_IDS.w2,
        reason: 'absent',
        replacementWinnerId: SEED_WINNER_RECORD_IDS.w3,
      },
      eventId: SEED_EVENT_IDS.history,
      id: SEED_AUDIT_RECORD_IDS.a2,
      timestamp: SEED_ISO_TIMESTAMPS.t3,
    },
  ]
}

export function getStandardSeedPreferences(): ApplicationPreference[] {
  return [
    {
      key: 'activeEventId',
      updatedAt: SEED_ISO_TIMESTAMPS.t1,
      value: SEED_EVENT_IDS.history,
    },
    {
      key: 'lastOperatorMode',
      updatedAt: SEED_ISO_TIMESTAMPS.t1,
      value: 'live',
    },
  ]
}

export function getAcceptanceSeedEvents(): Event[] {
  return [{
    createdAt: SEED_ISO_TIMESTAMPS.t0,
    description: 'Phase 5 browser acceptance event',
    id: SEED_EVENT_IDS.acceptance,
    name: 'Raffle OS Phase 5 Acceptance',
    status: 'live',
    updatedAt: SEED_ISO_TIMESTAMPS.t0,
  }]
}

export function getAcceptanceSeedPrizeCategories(): PrizeCategory[] {
  return [{
    createdAt: SEED_ISO_TIMESTAMPS.t0,
    description: 'Browser acceptance prize category',
    displayOrder: 1,
    eventId: SEED_EVENT_IDS.acceptance,
    id: ACCEPTANCE_SEED_IDS.category,
    name: 'Acceptance Prize',
    prizeName: 'Acceptance Test Prize',
  }]
}

export function getAcceptanceSeedDrawConfigurations(): DrawConfiguration[] {
  return [{
    createdAt: SEED_ISO_TIMESTAMPS.t0,
    eligibleGroupFilter: null,
    eventId: SEED_EVENT_IDS.acceptance,
    id: ACCEPTANCE_SEED_IDS.configuration,
    prizeCategoryId: ACCEPTANCE_SEED_IDS.category,
    requestedWinners: 2,
    requireCheckIn: true,
    updatedAt: SEED_ISO_TIMESTAMPS.t0,
    winningRule: 'once-per-event',
  }]
}

export function getAcceptanceSeedParticipants(): Participant[] {
  const tickets = ['00042', '42', '00043', '00044', '00045', '00046']
  return tickets.map((ticketNumber, index) => ({
    createdAt: SEED_ISO_TIMESTAMPS.t0,
    eventId: SEED_EVENT_IDS.acceptance,
    group: index % 2 === 0 ? 'VIP' : 'General',
    id: `aaaaaaa5-0000-4000-8000-${(index + 10).toString().padStart(12, '0')}` as ParticipantId,
    isCheckedIn: index < 4,
    name: `Acceptance Participant ${index + 1}`,
    notes: undefined,
    ticketNumber: ticketNumber as Participant['ticketNumber'],
    updatedAt: SEED_ISO_TIMESTAMPS.t0,
  }))
}

export function getAcceptanceSeedDrawSessions(): DrawSession[] {
  return [
    {
      candidatePoolSnapshot: null,
      configurationId: ACCEPTANCE_SEED_IDS.configuration,
      configurationSnapshot: null,
      createdAt: SEED_ISO_TIMESTAMPS.t1,
      eventId: SEED_EVENT_IDS.acceptance,
      id: ACCEPTANCE_SEED_IDS.practiceSession,
      mode: 'practice',
      status: 'ready',
      updatedAt: SEED_ISO_TIMESTAMPS.t1,
    },
    {
      candidatePoolSnapshot: null,
      configurationId: ACCEPTANCE_SEED_IDS.configuration,
      configurationSnapshot: null,
      createdAt: SEED_ISO_TIMESTAMPS.t1,
      eventId: SEED_EVENT_IDS.acceptance,
      id: ACCEPTANCE_SEED_IDS.liveSession,
      mode: 'live',
      status: 'ready',
      updatedAt: SEED_ISO_TIMESTAMPS.t1,
    },
  ]
}

export function getAcceptanceSeedPreferences(): ApplicationPreference[] {
  return [
    {
      key: 'activeEventId',
      updatedAt: SEED_ISO_TIMESTAMPS.t1,
      value: SEED_EVENT_IDS.acceptance,
    },
    {
      key: 'lastOperatorMode',
      updatedAt: SEED_ISO_TIMESTAMPS.t1,
      value: 'practice',
    },
  ]
}
