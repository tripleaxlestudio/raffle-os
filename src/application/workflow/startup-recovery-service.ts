import type { DrawSetupProductionServices } from '../draw/draw-setup-query.types.ts'
import { evaluateStartupRecovery, type StartupRecoveryResult } from './startup-recovery-arbiter.ts'

export type StartupRecoveryServices = Pick<
  DrawSetupProductionServices,
  'open' | 'checkStorage' | 'preferences' | 'events' | 'sessions' | 'winners'
> & {
  readonly redraws?: DrawSetupProductionServices['redraws']
  readonly receipts?: NonNullable<DrawSetupProductionServices['pendingDecisions']>['receipts']
  readonly presentationCheckpoints?: DrawSetupProductionServices['presentationCheckpoints']
}

/**
 * Reads the minimum authoritative records needed to make a boot decision.
 * This service is intentionally read-only: it never creates, repairs, or
 * selects anything while resolving startup state.
 */
export async function resolveStartupRecovery(
  services: StartupRecoveryServices,
): Promise<StartupRecoveryResult> {
  try {
    const readiness = services.checkStorage === undefined
      ? null
      : await services.checkStorage()
    if (readiness !== null && !readiness.ok) {
      return evaluateStartupRecovery({ activeEvent: null, sessions: [], storageError: readiness.reason })
    }
    if (services.checkStorage === undefined) await services.open()

    const activeEventId = await services.preferences.get('activeEventId')
    if (activeEventId === null) return evaluateStartupRecovery({ activeEvent: null, sessions: [] })

    const activeEvent = await services.events.findById(activeEventId)
    if (activeEvent === null) return evaluateStartupRecovery({ activeEvent: null, sessions: [] })

    const sessions = await services.sessions.findByEventId(activeEvent.id)
    const winners = await services.winners.findByEventId(activeEvent.id)
    const unresolved = sessions.filter(
      (session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'),
    )
    const related = await Promise.all(unresolved.map(async (session) => {
      const [redraws, receipts, checkpoint] = await Promise.all([
        services.redraws?.findByDrawSessionId(session.id) ?? Promise.resolve([]),
        services.receipts?.findBySession(session.id) ?? Promise.resolve([]),
        services.presentationCheckpoints?.findByDrawSessionId(session.id) ?? Promise.resolve(null),
      ])
      return { redraws, receipts, checkpoint }
    }))

    return evaluateStartupRecovery({
      activeEvent,
      sessions,
      winners,
      redraws: related.flatMap((item) => item.redraws),
      receipts: related.flatMap((item) => item.receipts),
      checkpoint: related.find((item) => item.checkpoint !== null)?.checkpoint ?? null,
    })
  } catch (cause: unknown) {
    return evaluateStartupRecovery({
      activeEvent: null,
      sessions: [],
      storageError: cause instanceof Error ? cause.message : 'Authoritative startup data could not be read safely.',
    })
  }
}
