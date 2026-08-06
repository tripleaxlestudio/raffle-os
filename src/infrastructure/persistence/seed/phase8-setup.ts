import type { DisplayConfiguration } from '../../../domain/display/display-configuration.types.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import type { Participant } from '../../../domain/participants/participant.types.ts'
import type { ApplicationPreference } from '../../../domain/preferences/application-preference.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import type { EventId, DrawConfigurationId, DrawSessionId, ParticipantId, PrizeCategoryId, DisplayConfigurationId } from '../../../domain/shared/identifiers.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { ImmutableRecordError } from '../errors/persistence-errors.ts'
import { resetDatabase, type DatabaseResetConfirmation } from './reset-db.ts'
import { writeValidatedSeedDataset } from './seed-transaction-writer.ts'
import { SEED_ISO_TIMESTAMPS, getStandardSeedAuditRecords, getStandardSeedDisplayConfigurations, getStandardSeedDrawConfigurations, getStandardSeedDrawSession, getStandardSeedEvents, getStandardSeedParticipants, getStandardSeedPreferences, getStandardSeedPrizeCategories, getStandardSeedRedrawRecord, getStandardSeedWinners } from './dev-seed-fixtures.ts'

export const PHASE8_SETUP_DATASETS = [
  { id: 'empty-workspace', name: 'Minimal empty workspace', description: 'No Event, categories, participants, or sessions.' },
  { id: 'ready-basic', name: 'Ready basic Event', description: 'One ready Event with a display, exact tickets 00042 and 42, and a small draw.' },
  { id: 'winner-count-matrix', name: 'Winner-count matrix', description: 'Ready sessions for 1, 6, 10, 20, and 50 winners.' },
  { id: 'lifecycle-history', name: 'Lifecycle and history recovery', description: 'Completed, pending, cancelled, redraw-lineage, and official-history records.' },
] as const

export type Phase8SetupDatasetId = typeof PHASE8_SETUP_DATASETS[number]['id']
export interface Phase8SetupReadback {
  readonly dataset: Phase8SetupDatasetId
  readonly eventIds: readonly EventId[]
  readonly sessionIds: readonly DrawSessionId[]
  readonly displayConfigurationIds: readonly DisplayConfigurationId[]
  readonly counts: Readonly<Record<string, number>>
  readonly activeEventId: EventId | null
}

const t0 = SEED_ISO_TIMESTAMPS.t0
const t1 = SEED_ISO_TIMESTAMPS.t1
const id = (prefix: string, number: number): string => `${prefix}${number.toString(16).padStart(12, '0')}`
const eventFor = (number: number): EventId => id('a8000000-0000-4000-8000-', number) as EventId
const categoryFor = (number: number): PrizeCategoryId => id('a8100000-0000-4000-8000-', number) as PrizeCategoryId
const configFor = (number: number): DrawConfigurationId => id('a8200000-0000-4000-8000-', number) as DrawConfigurationId
const sessionFor = (number: number): DrawSessionId => id('a8300000-0000-4000-8000-', number) as DrawSessionId
const displayFor = (number: number): DisplayConfigurationId => id('a8400000-0000-4000-8000-', number) as DisplayConfigurationId
const participantFor = (number: number): ParticipantId => id('a8500000-0000-4000-8000-', number) as ParticipantId

function display(eventId: EventId, number: number): DisplayConfiguration {
  return { id: displayFor(number), eventId, blackoutAppearance: 'pure-black', safeAreaMargin: 24, targetResolution: { width: 1920, height: 1080 }, createdAt: t0, updatedAt: t0 }
}

function participant(eventId: EventId, number: number, ticketNumber: string, checkedIn = true): Participant {
  return { id: participantFor(number), eventId, ticketNumber: ticketNumber as Participant['ticketNumber'], name: `Setup Participant ${number}`, group: number % 2 === 0 ? 'General' : 'VIP', isCheckedIn: checkedIn, notes: undefined, createdAt: t0, updatedAt: t0 }
}

function readySession(eventId: EventId, configurationId: DrawConfigurationId, number: number): DrawSession {
  return { id: sessionFor(number), eventId, configurationId, mode: 'live', status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: t1, updatedAt: t1, }
}

function basicDataset(): { events: Event[]; prizeCategories: PrizeCategory[]; drawConfigurations: DrawConfiguration[]; displayConfigurations: DisplayConfiguration[]; participants: Participant[]; drawSessions: DrawSession[]; preferences: ApplicationPreference[] } {
  const eventId = eventFor(1)
  const categoryId = categoryFor(1)
  const configId = configFor(1)
  return {
    events: [{ id: eventId, name: 'Raffle OS Ready Basic', description: 'Deterministic owner test Event', status: 'ready', createdAt: t0, updatedAt: t0 }],
    prizeCategories: [{ id: categoryId, eventId, name: 'Basic Prize', prizeName: 'Owner Test Prize', displayOrder: 1, createdAt: t0 }],
    drawConfigurations: [{ id: configId, eventId, prizeCategoryId: categoryId, requestedWinners: 2, winningRule: 'once-per-event', requireCheckIn: true, eligibleGroupFilter: null, createdAt: t0, updatedAt: t0 }],
    displayConfigurations: [display(eventId, 1)],
    participants: [participant(eventId, 1, '00042'), participant(eventId, 2, '42'), ...Array.from({ length: 8 }, (_, index) => participant(eventId, index + 3, String(index + 3).padStart(5, '0')))],
    drawSessions: [readySession(eventId, configId, 1)],
    preferences: [{ key: 'activeEventId', value: eventId, updatedAt: t1 }, { key: 'lastOperatorMode', value: 'live', updatedAt: t1 }],
  }
}

function matrixDataset(): ReturnType<typeof basicDataset> {
  const eventId = eventFor(2)
  const counts = [1, 6, 10, 20, 50]
  const categories = counts.map((count, index) => ({ id: categoryFor(index + 10), eventId, name: `${count}-winner category`, prizeName: `${count}-winner test prize`, displayOrder: index + 1, createdAt: t0 }))
  const configurations = counts.map((count, index) => ({ id: configFor(index + 10), eventId, prizeCategoryId: categoryFor(index + 10), requestedWinners: count, winningRule: 'once-per-event' as const, requireCheckIn: true, eligibleGroupFilter: null, createdAt: t0, updatedAt: t0 }))
  return { events: [{ id: eventId, name: 'Raffle OS Winner Count Matrix', status: 'ready', createdAt: t0, updatedAt: t0 }], prizeCategories: categories, drawConfigurations: configurations, displayConfigurations: [display(eventId, 2)], participants: Array.from({ length: 60 }, (_, index) => participant(eventId, index + 20, String(index + 1).padStart(5, '0'))), drawSessions: counts.map((_, index) => readySession(eventId, configFor(index + 10), index + 10)), preferences: [{ key: 'activeEventId', value: eventId, updatedAt: t1 }, { key: 'lastOperatorMode', value: 'live', updatedAt: t1 }] }
}

function standardDataset() {
  return { events: getStandardSeedEvents(), prizeCategories: getStandardSeedPrizeCategories(), drawConfigurations: getStandardSeedDrawConfigurations(), displayConfigurations: getStandardSeedDisplayConfigurations(), participants: getStandardSeedParticipants(), drawSessions: [getStandardSeedDrawSession()], winners: getStandardSeedWinners(), redrawRecord: getStandardSeedRedrawRecord(), auditRecords: getStandardSeedAuditRecords(), preferences: getStandardSeedPreferences() }
}

export async function resetPhase8Setup(database: RaffleOSDatabase, confirmation: DatabaseResetConfirmation) {
  return resetDatabase({ database, confirmation })
}

export async function seedPhase8Setup(database: RaffleOSDatabase, dataset: Phase8SetupDatasetId): Promise<Phase8SetupReadback> {
  if (dataset === 'empty-workspace') throw new ImmutableRecordError('The empty workspace dataset is created by reset only.')
  if (!database.isOpen()) await database.openSupported()
  const data = dataset === 'ready-basic' ? basicDataset() : dataset === 'winner-count-matrix' ? matrixDataset() : standardDataset()
  await database.transaction('rw', [database.events, database.participants, database.prize_categories, database.draw_configurations, database.display_configurations, database.draw_sessions, database.winner_records, database.redraw_records, database.audit_records, database.preferences], async () => {
    const existing = await Promise.all([database.events.count(), database.participants.count(), database.prize_categories.count(), database.draw_sessions.count()])
    if (existing.some((count) => count > 0)) throw new ImmutableRecordError('Reset the development database before loading another dataset.')
    await writeValidatedSeedDataset(database, data)
  })
  return readPhase8Setup(database, dataset)
}

export async function readPhase8Setup(database: RaffleOSDatabase, dataset: Phase8SetupDatasetId): Promise<Phase8SetupReadback> {
  if (!database.isOpen()) await database.openSupported()
  const [events, sessions, displays, activeEventId] = await Promise.all([database.events.toArray(), database.draw_sessions.toArray(), database.display_configurations.toArray(), database.preferences.get('activeEventId')])
  const counts = Object.fromEntries(await Promise.all(database.tables.map(async (table) => [table.name, await table.count()])))
  return { dataset, eventIds: events.map((event) => event.id), sessionIds: sessions.map((session) => session.id), displayConfigurationIds: displays.map((configuration) => configuration.id), counts, activeEventId: activeEventId?.key === 'activeEventId' ? activeEventId.value : null }
}
