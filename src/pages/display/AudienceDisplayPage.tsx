import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createAudienceController } from '../../application/display-transport/audience-controller.ts'
import type { PublicDisplaySnapshot } from '../../application/display-transport/public-projection.ts'
import { createBroadcastChannelTransport, type Transport } from '../../application/display-transport/transport.ts'
import type { ProtocolScope } from '../../application/display-transport/protocol.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import { BlackoutStage, CountdownStage, DisconnectedStage, RollingStage, StandbyStage, WinnerStage } from '../../ui/audience/index.ts'
import type { PublicAudienceScenario } from '../../ui/audience/audience-view.types.ts'

const productionScope: ProtocolScope = { eventId: 'production-event', displayId: 'public-display' }
const publicContext = { eventName: 'Raffle OS Audience', eventSubtitle: 'Public event presentation', prizeCategory: 'Current draw', prizeLabel: 'Winner announcement' } as const

type AudienceDisplayPageProps = Readonly<{ transport?: Transport; scope?: ProtocolScope; expectedSession?: DrawSessionId }>

function snapshotScenario(snapshot: PublicDisplaySnapshot): PublicAudienceScenario {
  return {
    ...publicContext,
    state: snapshot.stage,
    message: snapshot.stage === 'standby' ? 'Draw will begin shortly' : snapshot.stage === 'countdown' ? 'Get ready' : snapshot.stage === 'rolling' ? 'Drawing in progress' : undefined,
    countdownValue: snapshot.stage === 'countdown' ? '—' : undefined,
    ticketNumbers: snapshot.ticketNumbers,
    statusMessage: snapshot.stage === 'pending-handoff' ? 'Public result' : snapshot.stage === 'reveal' ? 'Results under verification' : undefined,
  }
}

function safeStatusScenario(state: 'connecting' | 'disconnected-safe'): PublicAudienceScenario {
  return { ...publicContext, state, message: state === 'connecting' ? 'Connecting to the operator' : 'Display connection interrupted', instruction: state === 'connecting' ? 'Waiting for a public presentation snapshot.' : 'Please wait for the operator.' }
}

export function AudienceDisplayPage({ transport: suppliedTransport, scope = productionScope, expectedSession }: AudienceDisplayPageProps) {
  const transport = useMemo(() => suppliedTransport ?? createBroadcastChannelTransport('raffle-os-display', scope), [scope, suppliedTransport])
  const controller = useMemo(() => createAudienceController({ transport, scope, expectedSession }), [expectedSession, scope, transport])
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  useEffect(() => () => controller.close(), [controller])

  if (state.kind === 'connecting' || state.kind === 'disconnected-safe') return <DisconnectedStage scenario={safeStatusScenario(state.kind)} />
  if (state.snapshot.blackoutRequested) return <BlackoutStage />
  const scenario = snapshotScenario(state.snapshot)
  switch (scenario.state) {
    case 'standby': return <StandbyStage scenario={scenario} />
    case 'countdown': return <CountdownStage scenario={scenario} />
    case 'rolling': return <RollingStage scenario={scenario} />
    case 'reveal':
    case 'pending-handoff': return <WinnerStage scenario={scenario} />
  }
}
