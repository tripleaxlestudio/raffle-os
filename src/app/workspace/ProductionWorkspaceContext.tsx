import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import { createDrawSetupProductionServices } from '../../infrastructure/composition/draw-command-production.ts'

export type ProductionWorkspaceState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty'; readonly reason: 'no-active-event' }
  | { readonly status: 'invalid-reference'; readonly eventId: string }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly event: Event
      readonly participantCount: number
      readonly checkedInParticipantCount: number
      readonly prizeCategoryCount: number
      readonly liveSessionCount: number
      readonly sessionCounts: Readonly<Record<DrawSession['status'], number>>
      readonly unresolvedSession: DrawSession | null
      readonly currentMode: AppMode | null
      readonly displayConfiguration: DisplayConfiguration | null
    }

const WorkspaceContext = createContext<ProductionWorkspaceState | undefined>(undefined)
const WORKSPACE_CHANGED = 'raffle-os:workspace-changed'

// eslint-disable-next-line react-refresh/only-export-components
export function signalProductionWorkspaceChanged(): void {
  window.dispatchEvent(new Event(WORKSPACE_CHANGED))
}

export function ProductionWorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<ProductionWorkspaceState>({ status: 'loading' })

  const refresh = useCallback(() => {
    let active = true
    void (async () => {
      setState({ status: 'loading' })
      try {
        await services.open()
        const activeEventId = await services.preferences.get('activeEventId')
        if (activeEventId === null) {
          if (active) setState({ status: 'empty', reason: 'no-active-event' })
          return
        }
        const event = await services.events.findById(activeEventId)
        if (event === null) {
          if (active) setState({ status: 'invalid-reference', eventId: activeEventId })
          return
        }
        const [participantCount, participants, categories, sessions, currentMode, displayConfiguration] = await Promise.all([
          services.participants.countByEventId(event.id),
          services.participants.findByEventId(event.id, { limit: 100_000, offset: 0 }),
          services.categories.findByEventId(event.id),
          services.sessions.findByEventId(event.id),
          services.preferences.get('lastOperatorMode'),
          services.displayConfigurations?.findByEventId(event.id) ?? Promise.resolve(null),
        ])
        const unresolvedSession = sessions
          .filter((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
        if (active) {
          const sessionCounts = sessions.reduce((counts, session) => ({ ...counts, [session.status]: counts[session.status] + 1 }), { draft: 0, ready: 0, drawing: 0, 'pending-confirmation': 0, completed: 0, cancelled: 0 } as Record<DrawSession['status'], number>)
          setState({
            status: 'ready',
            event,
            participantCount,
            checkedInParticipantCount: participants.filter((participant) => participant.isCheckedIn).length,
            prizeCategoryCount: categories.length,
            liveSessionCount: sessions.filter((session) => session.mode === 'live').length,
            sessionCounts,
            unresolvedSession,
            currentMode,
            displayConfiguration,
          })
        }
      } catch (cause: unknown) {
        if (active) setState({ status: 'error', message: cause instanceof Error ? cause.message : 'Authoritative workspace data could not be read safely.' })
      }
    })()
    return () => { active = false }
  }, [services])

  useEffect(() => {
    void refresh()
    const listener = () => { void refresh() }
    window.addEventListener(WORKSPACE_CHANGED, listener)
    return () => window.removeEventListener(WORKSPACE_CHANGED, listener)
  }, [refresh])

  return <WorkspaceContext.Provider value={state}>{children}</WorkspaceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProductionWorkspace(): ProductionWorkspaceState {
  const state = useContext(WorkspaceContext)
  if (state === undefined) throw new Error('useProductionWorkspace must be used inside ProductionWorkspaceProvider.')
  return state
}
