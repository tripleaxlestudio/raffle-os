export type PrototypeImportStep =
  | 'upload'
  | 'mapping'
  | 'validation'
  | 'summary'

export interface PrototypeImportFile {
  fileName: string
  fileSize: string
  fileType: 'XLSX' | 'CSV'
  sheetName: string
  totalRows: number
}

export interface PrototypeSourceColumn {
  heading: string
  samples: readonly string[]
}

export interface PrototypeColumnMapping {
  requirement: 'required' | 'optional'
  sourceColumn: string | null
  sourcePreview: readonly string[]
  targetField: string
}

export type PrototypeValidationStatus =
  | 'valid'
  | 'duplicate'
  | 'invalid'

export interface PrototypeValidationIssue {
  code:
    | 'duplicate-ticket'
    | 'empty-ticket'
    | 'malformed-email'
    | 'missing-name'
    | 'whitespace-normalized'
  message: string
  severity: 'normalization' | 'warning' | 'error'
}

export interface PrototypeParticipantRow {
  email: string
  group: string
  issues: readonly PrototypeValidationIssue[]
  participantName: string
  rowNumber: number
  status: PrototypeValidationStatus
  ticketNumber: string
}

export interface PrototypeImportSummary {
  eventTarget: string
  invalidRows: number
  mappedFields: readonly string[]
  strategy: 'replace' | 'merge'
  strategyLabel: string
  totalRows: number
  validRows: number
  duplicateRows: number
}

export interface PrototypeParticipantImportFixture {
  file: PrototypeImportFile
  mappings: readonly PrototypeColumnMapping[]
  rows: readonly PrototypeParticipantRow[]
  sourceColumns: readonly PrototypeSourceColumn[]
  summary: PrototypeImportSummary
}

export type PrototypeDrawMode = 'practice' | 'live'
export type PrototypeDrawSetupScenario = 'ready' | 'insufficient'
export type PrototypeLiveDrawState = 'ready' | 'running'
export type PrototypeLiveDrawStage = 'countdown' | 'rolling'
export type PrototypeWinningFrequency =
  | 'event'
  | 'category'
  | 'unlimited'

export interface PrototypeDrawConfiguration {
  readonly category: string
  readonly eventName: string
  readonly internalNote: string
  readonly prizeName: string
  readonly winnerCount: number
  readonly winningFrequency: PrototypeWinningFrequency
  readonly winningFrequencyLabel: string
}

export interface PrototypeEligibilitySummary {
  readonly checkedInParticipants: number
  readonly eligibleParticipants: number
  readonly excludedPreviousWinners: number
  readonly participantGroup: string
  readonly requestedWinners: number
  readonly totalParticipants: number
}

export interface PrototypePresentationSequence {
  readonly audioCue: string
  readonly celebrationEffect: string
  readonly countdownEnabled: boolean
  readonly countdownSeconds: number
  readonly reducedMotionSafe: boolean
  readonly revealStyle: string
  readonly rollingSeconds: number
}

export interface PrototypeSystemCheck {
  readonly detail: string
  readonly label: string
  readonly status: 'ready' | 'warning' | 'blocked'
}

export interface PrototypeAudiencePreview {
  readonly eventName: string
  readonly prizeName: string
  readonly resolution: '1920 × 1080'
  readonly stateLabel: string
  readonly tickets: readonly string[]
  readonly winnerCount: number
}

export interface PrototypeDrawSetupFixture {
  readonly audiencePreview: PrototypeAudiencePreview
  readonly configuration: PrototypeDrawConfiguration
  readonly eligibility: PrototypeEligibilitySummary
  readonly presentation: PrototypePresentationSequence
  readonly scenario: PrototypeDrawSetupScenario
}

export interface PrototypeLiveDrawFixture {
  readonly audiencePreviews: {
    readonly countdown: PrototypeAudiencePreview
    readonly ready: PrototypeAudiencePreview
    readonly rolling: PrototypeAudiencePreview
  }
  readonly configuration: PrototypeDrawConfiguration
  readonly eligibility: PrototypeEligibilitySummary
  readonly presentation: PrototypePresentationSequence
  readonly staticCountdownValue: string
  readonly systemChecks: readonly PrototypeSystemCheck[]
  readonly ticketStream: readonly string[]
}

export type PrototypeResultStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'replaced'

export type PrototypePendingResultsScenario =
  | 'pending'
  | 'partial'
  | 'confirmed'

export type PrototypeResultsPanel = 'summary' | 'redraw' | 'replacement'
export type PrototypeRedrawSelection = 'single' | 'multiple'

export interface PrototypeWinnerRecord {
  readonly checkIn: 'Checked in' | 'Not checked in'
  readonly group: string
  readonly participantName: string
  readonly replacementTicket?: string
  readonly status: PrototypeResultStatus
  readonly ticketNumber: string
}

export interface PrototypeResultsSummary {
  readonly cancelled: number
  readonly confirmed: number
  readonly drawSession: string
  readonly eligiblePoolSnapshot: number
  readonly pending: number
  readonly prize: string
  readonly replaced: number
  readonly totalResultRecords: number
}

export interface PrototypePendingResultsFixture {
  readonly scenario: PrototypePendingResultsScenario
  readonly summary: PrototypeResultsSummary
  readonly winners: readonly PrototypeWinnerRecord[]
}

export type PrototypeRedrawReason =
  | 'Participant absent'
  | 'Invalid ticket'
  | 'Ineligible participant'
  | 'Previous winner'
  | 'Operator error'
  | 'Other'

export interface PrototypeReplacementRelationship {
  readonly originalParticipant: string
  readonly originalTicket: string
  readonly reason: PrototypeRedrawReason
  readonly relationshipText: string
  readonly replacementParticipant: string
  readonly replacementTicket: string
}

export interface PrototypeRedrawFixture {
  readonly multipleOriginals: readonly PrototypeWinnerRecord[]
  readonly reasons: readonly PrototypeRedrawReason[]
  readonly relationship: PrototypeReplacementRelationship
  readonly singleOriginal: PrototypeWinnerRecord
}

export type PrototypeHistoryView =
  | 'sessions'
  | 'winners'
  | 'audit'
  | 'session-detail'

export interface PrototypeHistorySession {
  readonly category: string
  readonly dateTime: string
  readonly id: string
  readonly mode: 'Practice' | 'Live'
  readonly operator: string
  readonly prize: string
  readonly status: string
  readonly winnerCount: number
}

export interface PrototypeAuditEntry {
  readonly action: string
  readonly actor: string
  readonly detail: string
  readonly timestamp: string
}

export interface PrototypeHistoryFixture {
  readonly auditEntries: readonly PrototypeAuditEntry[]
  readonly sessions: readonly PrototypeHistorySession[]
  readonly winners: readonly PrototypeWinnerRecord[]
  readonly sessionDetail: {
    readonly configuration: readonly {
      readonly label: string
      readonly value: string
    }[]
    readonly eligiblePoolSnapshot: number
    readonly relationship: PrototypeReplacementRelationship
    readonly session: PrototypeHistorySession
  }
}

export type PrototypeSettingsSection =
  | 'branding'
  | 'presentation'
  | 'audio'
  | 'display'

export interface PrototypeSettingsFixture {
  readonly audio: {
    readonly countdownCue: string
    readonly masterVolume: string
    readonly rollingCue: string
    readonly winnerRevealCue: string
  }
  readonly branding: {
    readonly accentColor: string
    readonly eventName: string
    readonly eventSubtitle: string
    readonly primaryColor: string
  }
  readonly display: {
    readonly blackoutAppearance: string
    readonly safeArea: string
    readonly targetResolution: string
  }
  readonly presentation: {
    readonly celebrationEffect: string
    readonly countdownDuration: string
    readonly revealStyle: string
    readonly rollingDuration: string
    readonly winnerLayout: string
  }
}
