import type { ProtocolScope } from './protocol.ts'

export type RuntimeTraceSide = 'Operator' | 'Audience'
export type RuntimeTraceDirection = 'sent' | 'received' | 'local'
export type RuntimeTraceValidation = 'not-run' | 'accepted' | 'rejected'
export type RuntimeTraceOrdering = 'not-run' | 'accepted' | 'rejected'
export type RuntimePublicState = 'display-test' | 'standby' | 'draw' | 'unknown'

export type RuntimeTraceEntry = {
  readonly timestamp: string
  readonly side: RuntimeTraceSide
  readonly currentRoute: string
  readonly publisherControllerInstanceId: string
  readonly eventId: string
  readonly displayConfigurationId: string
  readonly channelName: string
  readonly scope: ProtocolScope
  readonly epoch: number
  readonly sequence: number
  readonly direction: RuntimeTraceDirection
  readonly messageType: string
  readonly publicState: RuntimePublicState
  readonly validationResult: RuntimeTraceValidation
  readonly orderingResult: RuntimeTraceOrdering
  readonly controllerStateBefore: string
  readonly controllerStateAfter: string
  readonly renderedState: string
  readonly acknowledgementStatus: string
  readonly rejectionReason: string
  readonly cleanupDisposeReason: string
}

export type RuntimeTracePatch = Partial<Omit<RuntimeTraceEntry, 'timestamp' | 'side' | 'currentRoute' | 'publisherControllerInstanceId' | 'eventId' | 'displayConfigurationId' | 'channelName' | 'scope'>>

const MAX_ENTRIES = 200
const listeners = new Set<() => void>()
const entries: RuntimeTraceEntry[] = []

const defaultRoute = () => typeof window === 'undefined' ? 'unknown' : `${window.location.pathname}${window.location.search}`
const emptyScope = (scope: ProtocolScope | undefined): ProtocolScope => scope ?? { eventId: 'unknown', displayId: 'unknown' }

export function appendRuntimeTrace(base: { readonly side: RuntimeTraceSide; readonly publisherControllerInstanceId: string; readonly scope?: ProtocolScope; readonly channelName?: string; readonly route?: () => string }, patch: RuntimeTracePatch): RuntimeTraceEntry {
  const scope = emptyScope(base.scope)
  const entry: RuntimeTraceEntry = {
    timestamp: new Date().toISOString(),
    side: base.side,
    currentRoute: base.route?.() ?? defaultRoute(),
    publisherControllerInstanceId: base.publisherControllerInstanceId,
    eventId: scope.eventId,
    displayConfigurationId: scope.displayId,
    channelName: base.channelName ?? `raffle-os-display:${scope.eventId}:${scope.displayId}`,
    scope,
    epoch: 0,
    sequence: 0,
    direction: 'local',
    messageType: 'runtime-marker',
    publicState: 'unknown',
    validationResult: 'not-run',
    orderingResult: 'not-run',
    controllerStateBefore: 'unknown',
    controllerStateAfter: 'unknown',
    renderedState: 'unknown',
    acknowledgementStatus: 'not-applicable',
    rejectionReason: 'none',
    cleanupDisposeReason: 'none',
    ...patch,
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
  listeners.forEach((listener) => { try { listener() } catch { /* diagnostics cannot affect the app */ } })
  return entry
}

export function getRuntimeTrace(): readonly RuntimeTraceEntry[] { return entries }
export function clearRuntimeTrace(): void { entries.splice(0, entries.length); listeners.forEach((listener) => { try { listener() } catch { /* diagnostics cannot affect the app */ } }) }
export function subscribeRuntimeTrace(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener) }
export function serializeRuntimeTrace(): string { return JSON.stringify(getRuntimeTrace(), null, 2) }
export function getRuntimeTraceLimit(): number { return MAX_ENTRIES }
