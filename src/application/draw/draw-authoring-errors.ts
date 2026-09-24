export const DRAW_AUTHORING_ERROR_CODES = {
  eventNotFound: 'event-not-found',
  categoryNotFound: 'category-not-found',
  crossEventRelationship: 'cross-event-relationship',
  configurationNotFound: 'configuration-not-found',
  sessionNotFound: 'session-not-found',
  sessionNotEditable: 'session-not-editable',
  invalidPrizeName: 'invalid-prize-name',
  invalidWinnerCount: 'invalid-winner-count',
  invalidMode: 'invalid-mode',
  invalidRule: 'invalid-rule',
  invalidFilter: 'invalid-filter',
  invalidPresentation: 'invalid-presentation',
  insufficientEligibleCapacity: 'insufficient-eligible-capacity',
  duplicateSave: 'duplicate-save',
  persistenceUnavailable: 'persistence-unavailable',
  readFailure: 'read-failure',
  writeFailure: 'write-failure',
} as const

export type DrawAuthoringErrorCode =
  (typeof DRAW_AUTHORING_ERROR_CODES)[keyof typeof DRAW_AUTHORING_ERROR_CODES]

export class DrawAuthoringError extends Error {
  readonly code: DrawAuthoringErrorCode
  readonly retryable: boolean

  constructor(
    code: DrawAuthoringErrorCode,
    message: string,
    options: { readonly retryable?: boolean; readonly cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'DrawAuthoringError'
    this.code = code
    this.retryable = options.retryable ?? false
  }
}
