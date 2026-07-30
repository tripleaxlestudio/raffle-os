export type AudienceWinnerCount = 1 | 6 | 10 | 20

export type AudienceQueryState =
  | 'standby'
  | 'countdown'
  | 'rolling'
  | 'reveal'
  | 'confirmed'
  | 'blackout'
  | 'disconnected'

export interface PublicAudienceBranding {
  readonly eventName: string
  readonly eventSubtitle: string
}

export interface PublicAudiencePrizeContext
  extends PublicAudienceBranding {
  readonly prizeCategory: string
  readonly prizeLabel: string
}

export interface PublicAudienceStandbyScenario
  extends PublicAudiencePrizeContext {
  readonly message: string
  readonly state: 'standby'
}

export interface PublicAudienceCountdownScenario
  extends PublicAudiencePrizeContext {
  readonly countdownValue: string
  readonly message: string
  readonly state: 'countdown'
}

export interface PublicAudienceRollingScenario
  extends PublicAudiencePrizeContext {
  readonly message: string
  readonly state: 'rolling'
  readonly ticketNumbers: readonly string[]
}

export interface PublicAudienceWinnerRevealScenario
  extends PublicAudiencePrizeContext {
  readonly layoutCount: AudienceWinnerCount
  readonly state: 'winner-reveal'
  readonly statusMessage: string
  readonly ticketNumbers: readonly string[]
}

export interface PublicAudienceConfirmedScenario
  extends PublicAudiencePrizeContext {
  readonly layoutCount: AudienceWinnerCount
  readonly state: 'confirmed'
  readonly statusMessage: string
  readonly ticketNumbers: readonly string[]
}

export interface PublicAudienceBlackoutScenario {
  readonly state: 'blackout'
}

export interface PublicAudienceDisconnectedScenario
  extends PublicAudienceBranding {
  readonly instruction: string
  readonly message: string
  readonly state: 'disconnected'
}

export type PublicAudienceScenario =
  | PublicAudienceStandbyScenario
  | PublicAudienceCountdownScenario
  | PublicAudienceRollingScenario
  | PublicAudienceWinnerRevealScenario
  | PublicAudienceConfirmedScenario
  | PublicAudienceBlackoutScenario
  | PublicAudienceDisconnectedScenario
