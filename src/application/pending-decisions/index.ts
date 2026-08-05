export type {
  CanonicalDecisionPayload,
  CancelPendingWinnersCommand,
  ConfirmPendingWinnersCommand,
  DecisionReason,
  DecisionTarget,
  PendingDecisionActor,
  PendingDecisionCommand,
  PendingDecisionOperation,
  PendingDecisionOutcome,
  PendingDecisionReceiptResult,
  RedrawConfirmedWinnersCommand,
  RedrawPendingWinnersCommand,
} from './command.types.ts'
export { LOCAL_OPERATOR } from './command.types.ts'
export { ConfirmationService, type ConfirmationApplicationResult } from './confirmation-service.ts'
export type { PendingDecisionError, PendingDecisionErrorCode, PendingDecisionErrorKind } from './validation.ts'
export {
  areEquivalentDecisionPayloads,
  canonicalizeDecisionPayload,
  isDecisionReason,
  validateCommandPayloadConflict,
  validateCommandTargets,
  validateExpectedStatuses,
  validateAllowedCommandTransition,
  validateLiveMutationMode,
  validateLiveMutationCommand,
} from './validation.ts'
