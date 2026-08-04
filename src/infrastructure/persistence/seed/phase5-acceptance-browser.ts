import type { DrawSessionStatus } from '../../../domain/draws/draw-session.types.ts'
import type { EventStatus } from '../../../domain/events/event.types.ts'
import { RaffleOSDatabase } from '../db.ts'
import { resetDatabase } from './reset-db.ts'
import { seedDevelopmentDatabase, type DevelopmentSeedResult } from './dev-seed.ts'

export interface AcceptanceInspectResult {
  readonly counts: DevelopmentSeedResult['counts']
  readonly activeEvent: {
    readonly id: string | null
    readonly name: string | null
    readonly status: EventStatus | null
  }
  readonly configuration: {
    readonly id: string | null
    readonly status: 'present' | 'missing'
    readonly requestedWinners: number | null
  }
  readonly sessions: readonly {
    readonly id: string
    readonly mode: 'practice' | 'live'
    readonly status: DrawSessionStatus
    readonly configurationSnapshotAttached: boolean
    readonly candidateSnapshotAttached: boolean
  }[]
}

export interface AcceptanceBrowserApi {
  reset(): Promise<{ status: 'deleted'; databaseName: string }>
  seed(): Promise<DevelopmentSeedResult>
  inspect(): Promise<AcceptanceInspectResult>
}

export interface AcceptanceBrowserApiOptions {
  readonly enabled: boolean
  readonly createDatabase?: () => RaffleOSDatabase
}

export function installAcceptanceBrowserApi(
  options: AcceptanceBrowserApiOptions,
): AcceptanceBrowserApi | undefined {
  if (!options.enabled) return undefined

  const createDatabase = options.createDatabase ?? (() => new RaffleOSDatabase())
  let resetCompleted = false

  const api: AcceptanceBrowserApi = {
    reset: async () => {
      const database = createDatabase()
      const result = await resetDatabase({
        confirmation: {
          acknowledgePermanentDataLoss: true,
          confirmationText: `DELETE ${database.name}`,
          databaseName: database.name,
        },
        database,
      })
      resetCompleted = true
      return result
    },
    seed: async () => {
      if (!resetCompleted) {
        throw new Error('Run window.__raffleAcceptance.reset() before seed().')
      }
      const result = await seedDevelopmentDatabase({
        database: createDatabase(),
        profile: 'phase5-acceptance',
      })
      resetCompleted = false
      return result
    },
    inspect: async () => {
      const database = createDatabase()
      await database.openSupported()
      const [events, participants, categories, configurations, displays, sessions, winners, redraws, audits, preferences] = await Promise.all([
        database.events.toArray(),
        database.participants.count(),
        database.prize_categories.toArray(),
        database.draw_configurations.toArray(),
        database.display_configurations.count(),
        database.draw_sessions.toArray(),
        database.winner_records.count(),
        database.redraw_records.count(),
        database.audit_records.count(),
        database.preferences.count(),
      ])
      const activeEventId = (await database.preferences.get('activeEventId'))?.value ?? null
      const activeEvent = events.find((event) => event.id === activeEventId) ?? null
      const configuration = configurations.find((candidate) => candidate.eventId === activeEvent?.id) ?? null
      database.close()
      return {
        activeEvent: { id: activeEvent?.id ?? null, name: activeEvent?.name ?? null, status: activeEvent?.status ?? null },
        configuration: { id: configuration?.id ?? null, requestedWinners: configuration?.requestedWinners ?? null, status: configuration === null ? 'missing' : 'present' },
        counts: {
          audit_records: audits,
          display_configurations: displays,
          draw_configurations: configurations.length,
          draw_sessions: sessions.length,
          events: events.length,
          participants,
          preferences,
          prize_categories: categories.length,
          redraw_records: redraws,
          winner_records: winners,
        },
        sessions: sessions.map((session) => ({
          candidateSnapshotAttached: session.candidatePoolSnapshot !== null,
          configurationSnapshotAttached: session.configurationSnapshot !== null,
          id: session.id,
          mode: session.mode,
          status: session.status,
        })),
      }
    },
  }

  globalThis.__raffleAcceptance = api
  return api
}
