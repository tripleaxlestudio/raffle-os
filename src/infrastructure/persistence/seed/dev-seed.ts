import type { Event } from '../../../domain/events/event.types.ts'
import type { Participant } from '../../../domain/participants/participant.types.ts'
import type { DisplayConfiguration } from '../../../domain/display/display-configuration.types.ts'
import type {
  DisplayConfigurationId,
  EventId,
  ParticipantId,
} from '../../../domain/shared/identifiers.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { ImmutableRecordError } from '../errors/persistence-errors.ts'
import {
  getStandardSeedAuditRecords,
  getStandardSeedDisplayConfigurations,
  getStandardSeedDrawConfigurations,
  getStandardSeedDrawSession,
  getStandardSeedEvents,
  getStandardSeedParticipants,
  getStandardSeedPreferences,
  getStandardSeedPrizeCategories,
  getStandardSeedRedrawRecord,
  getStandardSeedWinners,
  SEED_ISO_TIMESTAMPS,
} from './dev-seed-fixtures.ts'
import {
  writeValidatedSeedDataset,
} from './seed-transaction-writer.ts'

export interface DevelopmentSeedInput {
  readonly database: RaffleOSDatabase
  readonly profile?: 'standard' | 'capacity'
  readonly participantCount?: number
}

export interface DevelopmentSeedResult {
  readonly profile: 'standard' | 'capacity'
  readonly counts: {
    readonly events: number
    readonly participants: number
    readonly prize_categories: number
    readonly draw_configurations: number
    readonly display_configurations: number
    readonly draw_sessions: number
    readonly winner_records: number
    readonly redraw_records: number
    readonly audit_records: number
    readonly preferences: number
  }
}

export const DEFAULT_CAPACITY_PARTICIPANT_COUNT = 10000

export async function seedDevelopmentDatabase(
  input: DevelopmentSeedInput,
): Promise<DevelopmentSeedResult> {
  const database = input.database
  if (!database.isOpen()) {
    await database.openSupported()
  }

  const profile = input.profile ?? 'standard'
  const targetCapacityCount =
    input.participantCount ?? DEFAULT_CAPACITY_PARTICIPANT_COUNT

  let resultCounts!: DevelopmentSeedResult['counts']

  await database.transaction(
    'rw',
    [
      database.events,
      database.participants,
      database.prize_categories,
      database.draw_configurations,
      database.display_configurations,
      database.draw_sessions,
      database.winner_records,
      database.redraw_records,
      database.audit_records,
      database.preferences,
    ],
    async () => {
      // 1. Refuse existing data: Check all 10 stores for emptiness
      const existingCounts = await Promise.all([
        database.events.count(),
        database.participants.count(),
        database.prize_categories.count(),
        database.draw_configurations.count(),
        database.display_configurations.count(),
        database.draw_sessions.count(),
        database.winner_records.count(),
        database.redraw_records.count(),
        database.audit_records.count(),
        database.preferences.count(),
      ])

      const totalExisting = existingCounts.reduce((a, b) => a + b, 0)
      if (totalExisting > 0) {
        throw new ImmutableRecordError(
          'Cannot seed database: database already contains data.',
        )
      }

      if (profile === 'standard') {
        const events = getStandardSeedEvents()
        const prizeCategories = getStandardSeedPrizeCategories()
        const drawConfigurations = getStandardSeedDrawConfigurations()
        const displayConfigurations =
          getStandardSeedDisplayConfigurations()
        const participants = getStandardSeedParticipants()
        const drawSession = getStandardSeedDrawSession()
        const winners = getStandardSeedWinners()
        const redrawRecord = getStandardSeedRedrawRecord()
        const auditRecords = getStandardSeedAuditRecords()
        const preferences = getStandardSeedPreferences()

        await writeValidatedSeedDataset(database, {
          auditRecords,
          displayConfigurations,
          drawConfigurations,
          drawSession,
          events,
          participants,
          preferences,
          prizeCategories,
          redrawRecord,
          winners,
        })

        resultCounts = {
          audit_records: auditRecords.length,
          display_configurations: displayConfigurations.length,
          draw_configurations: drawConfigurations.length,
          draw_sessions: 1,
          events: events.length,
          participants: participants.length,
          preferences: preferences.length,
          prize_categories: prizeCategories.length,
          redraw_records: 1,
          winner_records: winners.length,
        }
      } else {
        // Capacity profile
        const capacityEventId =
          'c0000000-0000-4000-8000-000000000001' as EventId
        const capacityDisplayId =
          'c0000000-0000-4000-8000-000000000002' as DisplayConfigurationId

        const capacityEvent: Event = {
          createdAt: SEED_ISO_TIMESTAMPS.t0,
          description: 'Development event for capacity testing',
          id: capacityEventId,
          name: 'Raffle OS Capacity Event',
          status: 'draft',
          updatedAt: SEED_ISO_TIMESTAMPS.t0,
        }

        const capacityDisplay: DisplayConfiguration = {
          blackoutAppearance: 'pure-black',
          createdAt: SEED_ISO_TIMESTAMPS.t0,
          eventId: capacityEventId,
          id: capacityDisplayId,
          safeAreaMargin: 24,
          targetResolution: { height: 1080, width: 1920 },
          updatedAt: SEED_ISO_TIMESTAMPS.t0,
        }

        // Validate event & display config first
        await writeValidatedSeedDataset(database, {
          displayConfigurations: [capacityDisplay],
          drawConfigurations: [],
          events: [capacityEvent],
          participants: [],
          prizeCategories: [],
        })

        // Insert participant records in bounded batches (1,000 per batch)
        const batchSize = 1000
        let insertedCount = 0

        for (
          let batchStart = 1;
          batchStart <= targetCapacityCount;
          batchStart += batchSize
        ) {
          const batchEnd = Math.min(
            batchStart + batchSize - 1,
            targetCapacityCount,
          )
          const batchParticipants: Participant[] = []

          for (let index = batchStart; index <= batchEnd; index++) {
            const paddedId = index.toString().padStart(12, '0')
            const ticketNumber = index.toString().padStart(6, '0') as Participant['ticketNumber']
            batchParticipants.push({
              createdAt: SEED_ISO_TIMESTAMPS.t0,
              eventId: capacityEventId,
              group: 'General',
              id: `c0000000-0000-4000-8000-${paddedId}` as ParticipantId,
              isCheckedIn: true,
              name: `Capacity Participant ${index}`,
              notes: undefined,
              ticketNumber,
              updatedAt: SEED_ISO_TIMESTAMPS.t0,
            })
          }

          // Use writeValidatedSeedDataset to validate and bulkAdd batch
          await writeValidatedSeedDataset(database, {
            displayConfigurations: [],
            drawConfigurations: [],
            events: [],
            participants: batchParticipants,
            prizeCategories: [],
          })

          insertedCount += batchParticipants.length
        }

        resultCounts = {
          audit_records: 0,
          display_configurations: 1,
          draw_configurations: 0,
          draw_sessions: 0,
          events: 1,
          participants: insertedCount,
          preferences: 0,
          prize_categories: 0,
          redraw_records: 0,
          winner_records: 0,
        }
      }
    },
  )

  return {
    counts: resultCounts,
    profile,
  }
}
