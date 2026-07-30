import type {
  DrawConfiguration,
  DrawConfigurationMutationContext,
} from './draw-configuration.types.ts'
import type {
  CandidatePoolSnapshot,
  DrawConfigurationSnapshot,
  DrawSession,
  DrawSessionStatus,
  DrawStartSnapshots,
} from './draw-session.types.ts'
import {
  failure,
  success,
  type Result,
} from '../shared/result.ts'
import {
  isIsoTimestamp,
  type IsoTimestamp,
} from '../shared/timestamps.ts'

const permittedSessionTransitions: Readonly<
  Record<DrawSessionStatus, readonly DrawSessionStatus[]>
> = {
  cancelled: [],
  completed: [],
  draft: ['ready', 'cancelled'],
  drawing: ['pending-confirmation', 'cancelled'],
  'pending-confirmation': ['completed', 'cancelled'],
  ready: ['draft', 'drawing', 'cancelled'],
}

export function validateRequestedWinners(
  value: unknown,
): Result<number> {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 100
  ) {
    return failure(
      'invalid-requested-winners',
      'Requested winners must be an integer from 1 through 100.',
    )
  }

  return success(value)
}

export function validateDrawConfiguration(
  configuration: DrawConfiguration,
): Result<DrawConfiguration> {
  const winnerCount = validateRequestedWinners(
    configuration.requestedWinners,
  )
  if (!winnerCount.ok) {
    return winnerCount
  }

  if (
    !isIsoTimestamp(configuration.createdAt) ||
    !isIsoTimestamp(configuration.updatedAt)
  ) {
    return failure(
      'invalid-configuration-timestamp',
      'Draw configuration timestamps must be valid ISO UTC values.',
    )
  }

  return success(configuration)
}

export function validateDrawConfigurationUpdate(
  current: DrawConfiguration,
  proposed: DrawConfiguration,
  context: DrawConfigurationMutationContext,
): Result<DrawConfiguration> {
  if (context.hasStartedDrawSession) {
    return failure(
      'immutable-used-configuration',
      'A configuration cannot change after a session starts drawing.',
    )
  }

  if (
    current.id !== proposed.id ||
    current.eventId !== proposed.eventId ||
    current.prizeCategoryId !== proposed.prizeCategoryId ||
    current.createdAt !== proposed.createdAt
  ) {
    return failure(
      'immutable-configuration-identity',
      'Configuration identity and parent fields cannot change.',
    )
  }

  return validateDrawConfiguration(proposed)
}

export function validateConfigurationSnapshot(
  snapshot: DrawConfigurationSnapshot,
): Result<DrawConfigurationSnapshot> {
  const winnerCount = validateRequestedWinners(
    snapshot.requestedWinners,
  )
  if (!winnerCount.ok) {
    return winnerCount
  }

  if (
    snapshot.snapshotFormatVersion !== 1 ||
    snapshot.categoryName.trim().length === 0 ||
    snapshot.prizeName.trim().length === 0 ||
    !isIsoTimestamp(snapshot.capturedAt)
  ) {
    return failure(
      'invalid-configuration-snapshot',
      'Configuration snapshot is incomplete or invalid.',
    )
  }

  return success(snapshot)
}

export function validateCandidatePoolSnapshot(
  snapshot: CandidatePoolSnapshot,
): Result<CandidatePoolSnapshot> {
  if (
    snapshot.snapshotFormatVersion !== 1 ||
    !isIsoTimestamp(snapshot.capturedAt)
  ) {
    return failure(
      'invalid-candidate-snapshot',
      'Candidate snapshot version and timestamp must be valid.',
    )
  }

  if (
    snapshot.eligibleSnapshotCount !==
    snapshot.candidateEntries.length
  ) {
    return failure(
      'candidate-count-mismatch',
      'Eligible snapshot count must equal the candidate entry count.',
    )
  }

  const participantIds = new Set<string>()
  const ticketNumbers = new Set<string>()

  for (const candidate of snapshot.candidateEntries) {
    if (participantIds.has(candidate.participantId)) {
      return failure(
        'duplicate-candidate-participant',
        'Candidate participant IDs must be unique within a snapshot.',
      )
    }

    if (ticketNumbers.has(candidate.ticketNumber)) {
      return failure(
        'duplicate-candidate-ticket',
        'Candidate ticket numbers must be unique within a snapshot.',
      )
    }

    participantIds.add(candidate.participantId)
    ticketNumbers.add(candidate.ticketNumber)
  }

  return success(snapshot)
}

export function validateDrawStartSnapshots(
  snapshots: DrawStartSnapshots,
): Result<DrawStartSnapshots> {
  const configurationResult = validateConfigurationSnapshot(
    snapshots.configurationSnapshot,
  )
  if (!configurationResult.ok) {
    return configurationResult
  }

  const candidateResult = validateCandidatePoolSnapshot(
    snapshots.candidatePoolSnapshot,
  )
  if (!candidateResult.ok) {
    return candidateResult
  }

  const configuration = snapshots.configurationSnapshot
  const candidates = snapshots.candidatePoolSnapshot

  if (
    configuration.winningRule !== candidates.winningRule ||
    configuration.requireCheckIn !== candidates.requireCheckIn ||
    configuration.eligibleGroupFilter !==
      candidates.eligibleGroupFilter
  ) {
    return failure(
      'snapshot-rule-mismatch',
      'Candidate rules must match the configuration snapshot.',
    )
  }

  if (
    candidates.eligibleSnapshotCount <
    configuration.requestedWinners
  ) {
    return failure(
      'insufficient-candidate-snapshot',
      'Candidate snapshot is smaller than the requested winner count.',
    )
  }

  return success(snapshots)
}

export function validateDrawSession(
  session: DrawSession,
): Result<DrawSession> {
  const hasConfiguration =
    session.configurationSnapshot !== null
  const hasCandidates = session.candidatePoolSnapshot !== null

  if (hasConfiguration !== hasCandidates) {
    return failure(
      'partial-draw-snapshots',
      'Draw session snapshots must be either both absent or both present.',
    )
  }

  if (
    session.status !== 'draft' &&
    session.status !== 'ready' &&
    (!hasConfiguration || !hasCandidates)
  ) {
    return failure(
      'missing-draw-snapshots',
      'A started draw session requires both immutable snapshots.',
    )
  }

  if (
    !isIsoTimestamp(session.createdAt) ||
    !isIsoTimestamp(session.updatedAt) ||
    (session.completedAt !== undefined &&
      !isIsoTimestamp(session.completedAt))
  ) {
    return failure(
      'invalid-draw-session-timestamp',
      'Draw session timestamps must be valid ISO UTC values.',
    )
  }

  if (
    session.configurationSnapshot !== null &&
    session.candidatePoolSnapshot !== null
  ) {
    return validateDrawStartSnapshots({
      candidatePoolSnapshot: session.candidatePoolSnapshot,
      configurationSnapshot: session.configurationSnapshot,
    }).ok
      ? success(session)
      : failure(
          'invalid-draw-session-snapshots',
          'Draw session snapshots do not satisfy start invariants.',
        )
  }

  return success(session)
}

export function canTransitionDrawSessionStatus(
  from: DrawSessionStatus,
  to: DrawSessionStatus,
): boolean {
  return permittedSessionTransitions[from].includes(to)
}

export function attachSnapshotsAndStartDrawing(
  session: DrawSession,
  snapshots: DrawStartSnapshots,
  at: IsoTimestamp,
): Result<DrawSession> {
  if (session.status !== 'ready') {
    return failure(
      'draw-session-not-ready',
      'Only a ready draw session can start drawing.',
    )
  }

  if (
    session.configurationSnapshot !== null ||
    session.candidatePoolSnapshot !== null
  ) {
    return failure(
      'draw-snapshots-already-attached',
      'Attached draw snapshots cannot be replaced.',
    )
  }

  if (
    session.configurationId !==
    snapshots.configurationSnapshot.configurationId
  ) {
    return failure(
      'configuration-snapshot-mismatch',
      'Snapshot configuration must match the draw session.',
    )
  }

  const snapshotResult = validateDrawStartSnapshots(snapshots)
  if (!snapshotResult.ok) {
    return snapshotResult
  }

  return success({
    ...session,
    candidatePoolSnapshot: snapshots.candidatePoolSnapshot,
    configurationSnapshot: snapshots.configurationSnapshot,
    status: 'drawing',
    updatedAt: at,
  })
}

export function transitionDrawSessionStatus(
  session: DrawSession,
  to: Exclude<DrawSessionStatus, 'drawing'>,
  at: IsoTimestamp,
): Result<DrawSession> {
  if (!isIsoTimestamp(at)) {
    return failure(
      'invalid-draw-transition-timestamp',
      'Draw transition timestamp must be a valid ISO UTC value.',
    )
  }

  const currentResult = validateDrawSession(session)
  if (!currentResult.ok) {
    return currentResult
  }

  if (!canTransitionDrawSessionStatus(session.status, to)) {
    return failure(
      'unsupported-draw-session-transition',
      `Draw session cannot transition from ${session.status} to ${to}.`,
    )
  }

  const transitioned: DrawSession = {
    ...session,
    completedAt: to === 'completed' ? at : session.completedAt,
    status: to,
    updatedAt: at,
  }

  return validateDrawSession(transitioned)
}
