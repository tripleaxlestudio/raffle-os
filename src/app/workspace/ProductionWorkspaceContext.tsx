import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
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
      readonly unresolvedSession: DrawSession | null
      readonly currentMode: AppMode | null
    }

const WorkspaceContext = createContext<ProductionWorkspaceState | undefined>(undefined)

export function ProductionWorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const services = useMemo(() => createDrawSetupProductionServices(), [])
  const [state, setState] = useState<ProductionWorkspaceState>({ status: 'loading' })

  useEffect(() => {
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
        const [participantCount, participants, categories, sessions, currentMode] = await Promise.all([
          services.participants.countByEventId(event.id),
          services.participants.findByEventId(event.id, { limit: 100_000, offset: 0 }),
          services.categories.findByEventId(event.id),
          services.sessions.findByEventId(event.id),
          services.preferences.get('lastOperatorMode'),
        ])
        const unresolvedSession = sessions
          .filter((session) => session.mode === 'live' && (session.status === 'drawing' || session.status === 'pending-confirmation'))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
        if (active) {
          setState({
            status: 'ready',
            event,
            participantCount,
            checkedInParticipantCount: participants.filter((participant) => participant.isCheckedIn).length,
            prizeCategoryCount: categories.length,
            liveSessionCount: sessions.filter((session) => session.mode === 'live').length,
            unresolvedSession,
            currentMode,
          })
        }
      } catch (cause: unknown) {
        if (active) setState({ status: 'error', message: cause instanceof Error ? cause.message : 'Authoritative workspace data could not be read safely.' })
      }
    })()
    return () => { active = false }
  }, [services])

  return <WorkspaceContext.Provider value={state}>{children}</WorkspaceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProductionWorkspace(): ProductionWorkspaceState {
  const state = useContext(WorkspaceContext)
  if (state === undefined) throw new Error('useProductionWorkspace must be used inside ProductionWorkspaceProvider.')
  return state
}
