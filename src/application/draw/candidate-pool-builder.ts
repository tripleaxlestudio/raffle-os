import {
  validateCandidatePoolSnapshot,
} from '../../domain/draws/draw.invariants.ts'
import type { CandidatePoolSnapshot } from '../../domain/draws/draw-session.types.ts'
import { isIsoTimestamp } from '../../domain/shared/timestamps.ts'
import {
  evaluateEligibility,
  type EligibilityDecision,
  type EligibilityResult,
} from '../eligibility/index.ts'
import {
  candidatePoolFailure,
  type CandidatePoolFailure,
} from './candidate-pool-errors.ts'
import type {
  CandidatePoolBuildInput,
  CandidatePoolBuildOutput,
  CandidatePoolDiagnostics,
  CandidatePoolEligibilityEvaluator,
} from './candidate-pool.types.ts'
import type { Result } from '../../domain/shared/result.ts'

export type CandidatePoolBuildResult = Result<
  CandidatePoolBuildOutput,
  CandidatePoolFailure
>

function compareCodeUnitStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function deepFreeze<T extends object>(value: T): T {
  Object.freeze(value)
  for (const child of Object.values(value)) {
    if (typeof child === 'object' && child !== null && !Object.isFrozen(child)) {
      deepFreeze(child)
    }
  }
  return value
}

function diagnosticsFrom(decisions: readonly EligibilityDecision[]): CandidatePoolDiagnostics {
  const exclusionCounts: Partial<
    Record<EligibilityDecision['exclusionReasons'][number], number>
  > = {}
  for (const decision of decisions) {
    for (const reason of decision.exclusionReasons) {
      exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1
    }
  }
  const eligibleCount = decisions.filter((decision) => decision.eligible).length
  return {
    totalEvaluated: decisions.length,
    eligibleCount,
    excludedCount: decisions.length - eligibleCount,
    exclusionCounts,
  }
}

function eligibilityFailure(error: CandidatePoolFailure['eligibilityFailure']): CandidatePoolFailure {
  return candidatePoolFailure(
    error?.kind ?? 'integrity',
    error?.code ?? 'eligibility-failure',
    error?.message ?? 'Eligibility evaluation failed.',
    { eligibilityFailure: error },
  )
}

function validateEligibilityResult(
  result: EligibilityResult,
  input: CandidatePoolBuildInput,
): CandidatePoolFailure | null {
  if (
    result.eventId !== input.activeEvent.id ||
    result.configurationId !== input.drawConfiguration.id ||
    result.prizeCategoryId !== input.prizeCategory.id
  ) {
    return candidatePoolFailure(
      'relationship',
      'invalid-eligibility-result',
      'Eligibility results must belong to the active Event, configuration, and category.',
    )
  }
  if (result.mode !== input.mode) {
    return candidatePoolFailure(
      'relationship',
      'candidate-mode-mismatch',
      'Eligibility results must use the requested draw mode.',
    )
  }
  if (
    result.eligibleCount !== result.eligibleEntries.length ||
    result.excludedCount !== result.decisions.length - result.eligibleCount
  ) {
    return candidatePoolFailure(
      'integrity',
      'candidate-count-mismatch',
      'Eligibility counts must match the returned decisions and entries.',
    )
  }

  const participantsById = new Map(
    input.participants.map((participant) => [participant.id, participant]),
  )
  const decisionsById = new Map<string, EligibilityDecision>()
  for (const decision of result.decisions) {
    const participant = participantsById.get(decision.participantId)
    if (
      participant === undefined ||
      participant.ticketNumber !== decision.ticketNumber
    ) {
      return candidatePoolFailure(
        'integrity',
        'candidate-source-mismatch',
        'Every eligibility decision must exactly match a persisted Participant.',
        { participantId: decision.participantId, ticketNumber: decision.ticketNumber },
      )
    }
    if (decisionsById.has(decision.participantId)) {
      return candidatePoolFailure(
        'integrity',
        'duplicate-candidate-participant',
        'Eligibility decisions must contain unique Participant IDs.',
        { participantId: decision.participantId },
      )
    }
    decisionsById.set(decision.participantId, decision)
  }
  const candidateIds = new Set<string>()
  const tickets = new Set<string>()
  for (const entry of result.eligibleEntries) {
    const participant = participantsById.get(entry.participantId)
    const decision = decisionsById.get(entry.participantId)
    if (
      participant === undefined ||
      decision === undefined ||
      !decision.eligible ||
      participant.eventId !== input.activeEvent.id ||
      participant.ticketNumber !== entry.ticketNumber ||
      decision.ticketNumber !== entry.ticketNumber
    ) {
      return candidatePoolFailure(
        'integrity',
        'candidate-source-mismatch',
        'Every eligible candidate must exactly match an eligible decision and persisted Participant.',
        { participantId: entry.participantId, ticketNumber: entry.ticketNumber },
      )
    }
    if (candidateIds.has(entry.participantId)) {
      return candidatePoolFailure(
        'integrity',
        'duplicate-candidate-participant',
        'Candidate Participant IDs must be unique.',
        { participantId: entry.participantId },
      )
    }
    if (tickets.has(entry.ticketNumber)) {
      return candidatePoolFailure(
        'integrity',
        'duplicate-candidate-ticket',
        'Candidate ticket numbers must be unique.',
        { ticketNumber: entry.ticketNumber },
      )
    }
    candidateIds.add(entry.participantId)
    tickets.add(entry.ticketNumber)
  }
  return null
}

export function buildCandidatePool(
  input: CandidatePoolBuildInput,
  evaluator: CandidatePoolEligibilityEvaluator = evaluateEligibility,
): CandidatePoolBuildResult {
  if (!isIsoTimestamp(input.capturedAt)) {
    return {
      ok: false,
      error: candidatePoolFailure(
        'validation',
        'invalid-capture-time',
        'Candidate pool capture time must be a valid ISO UTC timestamp.',
      ),
    }
  }

  const evaluation = evaluator(input)
  if (!evaluation.ok) {
    return { ok: false, error: eligibilityFailure(evaluation.error) }
  }
  const validationFailure = validateEligibilityResult(evaluation.value, input)
  if (validationFailure !== null) return { ok: false, error: validationFailure }

  const diagnostics = diagnosticsFrom(evaluation.value.decisions)
  if (diagnostics.eligibleCount === 0) {
    return {
      ok: false,
      error: candidatePoolFailure(
        'capacity',
        'zero-eligible-candidates',
        'At least one eligible candidate is required to start a draw.',
        { requested: input.drawConfiguration.requestedWinners, available: 0 },
      ),
    }
  }
  if (diagnostics.eligibleCount < input.drawConfiguration.requestedWinners) {
    return {
      ok: false,
      error: candidatePoolFailure(
        'capacity',
        'insufficient-candidates',
        'The eligible candidate count is smaller than the requested winner count.',
        {
          requested: input.drawConfiguration.requestedWinners,
          available: diagnostics.eligibleCount,
        },
      ),
    }
  }

  const candidateEntries = evaluation.value.eligibleEntries
    .map((entry) => ({ ...entry }))
    .sort((left, right) =>
      compareCodeUnitStrings(left.ticketNumber, right.ticketNumber) ||
      compareCodeUnitStrings(left.participantId, right.participantId),
    )
  const snapshot: CandidatePoolSnapshot = {
    candidateEntries,
    capturedAt: input.capturedAt,
    configurationId: input.drawConfiguration.id,
    eligibleGroupFilter: input.drawConfiguration.eligibleGroupFilter,
    eligibleSnapshotCount: candidateEntries.length,
    eventId: input.activeEvent.id,
    mode: input.mode,
    prizeCategoryId: input.prizeCategory.id,
    requireCheckIn: input.drawConfiguration.requireCheckIn,
    snapshotFormatVersion: 1,
    winningRule: input.drawConfiguration.winningRule,
  }
  const snapshotValidation = validateCandidatePoolSnapshot(snapshot)
  if (!snapshotValidation.ok) {
    return {
      ok: false,
      error: candidatePoolFailure(
        'integrity',
        'invalid-eligibility-result',
        snapshotValidation.error.message,
      ),
    }
  }
  deepFreeze(snapshot)
  deepFreeze(diagnostics)
  return {
    ok: true,
    value: {
      decisions: evaluation.value.decisions,
      diagnostics,
      snapshot,
    },
  }
}
