export type AudienceViewState =
  | 'standby'
  | 'countdown'
  | 'rolling'
  | 'reveal'
  | 'pending-handoff'
  | 'winner-reveal'
  | 'confirmed'
  | 'disconnected'
  | 'blackout'
  | 'connecting'
  | 'disconnected-safe'

export type PublicAudienceContext = Readonly<{
  readonly eventName: string
  readonly eventSubtitle: string
  readonly prizeCategory: string
  readonly prizeLabel: string
  readonly prototypeStatic?: boolean
}>

export type PublicAudienceScenario = PublicAudienceContext &
  Readonly<{
    readonly state: AudienceViewState
    readonly message?: string
    readonly countdownValue?: string
    readonly ticketNumbers?: readonly string[]
    readonly statusMessage?: string
    readonly instruction?: string
    readonly layoutCount?: 1 | 6 | 10 | 20
  }>
