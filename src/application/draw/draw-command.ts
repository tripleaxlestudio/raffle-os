import { validateDrawConfiguration } from '../../domain/draws/draw.invariants.ts'
import { validateEvent } from '../../domain/events/event.invariants.ts'
import { validatePrizeCategory } from '../../domain/prizes/prize.types.ts'
import { validateDrawSession } from '../../domain/draws/draw.invariants.ts'
import { resolveDrawPresentationConfiguration } from '../../domain/draws/draw-presentation.types.ts'
import { isIsoTimestamp } from '../../domain/shared/timestamps.ts'
import { buildCandidatePool } from './candidate-pool-builder.ts'
import { evaluateEligibility } from '../eligibility/eligibility-evaluator.ts'
import { selectWinners } from './winner-selection.ts'
import { drawCommandFailure, type DrawCommandFailure } from './draw-command-errors.ts'
import type { DrawCommandDependencies, DrawCommandExecution, DrawCommandInput, DrawCommandResult } from './draw-command.types.ts'
import { productionUpdateLock } from '../update/update-lock.ts'

const PARTICIPANT_PAGE_SIZE = 1000

function failure(
  kind: DrawCommandFailure['kind'],
  code: DrawCommandFailure['code'],
  message: string,
  cause?: unknown,
): DrawCommandExecution {
  return { ok: false, error: drawCommandFailure(kind, code, message, { cause }) }
}

async function loadParticipants(
  dependencies: DrawCommandDependencies,
  eventId: DrawCommandInput['eventId'],
): Promise<readonly import('../../domain/participants/participant.types.ts').Participant[]> {
  const total = await dependencies.participants.countByEventId(eventId)
  const records: import('../../domain/participants/participant.types.ts').Participant[] = []
  for (let offset = 0; offset < total; offset += PARTICIPANT_PAGE_SIZE) {
    const page = await dependencies.participants.findByEventId(eventId, {
      limit: PARTICIPANT_PAGE_SIZE,
      offset,
    })
    records.push(...page)
    if (page.length === 0) break
  }
  return records
}

function makeConfigurationSnapshot(
  configuration: import('../../domain/draws/draw-configuration.types.ts').DrawConfiguration,
  category: import('../../domain/prizes/prize.types.ts').PrizeCategory,
  capturedAt: import('../../domain/shared/timestamps.ts').IsoTimestamp,
): import('../../domain/draws/draw-session.types.ts').DrawConfigurationSnapshot {
  return Object.freeze({
    snapshotFormatVersion: 1,
    configurationId: configuration.id,
    prizeCategoryId: category.id,
    categoryName: category.name,
    prizeName: category.prizeName,
    requestedWinners: configuration.requestedWinners,
    winningRule: configuration.winningRule,
    requireCheckIn: configuration.requireCheckIn,
    eligibleGroupFilter: configuration.eligibleGroupFilter,
    presentation: resolveDrawPresentationConfiguration(configuration.presentation),
    capturedAt,
  })
}

function validateSources(
  event: import('../../domain/events/event.types.ts').Event,
  configuration: import('../../domain/draws/draw-configuration.types.ts').DrawConfiguration,
  category: import('../../domain/prizes/prize.types.ts').PrizeCategory,
  session: import('../../domain/draws/draw-session.types.ts').DrawSession,
  input: DrawCommandInput,
): DrawCommandExecution | null {
  if (!validateEvent(event).ok || (event.status !== 'ready' && event.status !== 'live')) {
    return failure('validation', 'event-not-active', 'The Event is not active and cannot start a draw.')
  }
  if (!validateDrawConfiguration(configuration).ok) {
    return failure('validation', 'persistence-failed', 'The DrawConfiguration is invalid.')
  }
  if (!validatePrizeCategory(category).ok) {
    return failure('validation', 'persistence-failed', 'The PrizeCategory is invalid.')
  }
  if (!validateDrawSession(session).ok) {
    return failure('integrity', 'persistence-failed', 'The DrawSession contains contradictory persisted data.')
  }
  if (session.eventId !== input.eventId) return failure('relationship', 'session-event-mismatch', 'DrawSession does not belong to the requested Event.')
  if (session.configurationId !== configuration.id || configuration.eventId !== event.id) return failure('relationship', 'session-configuration-mismatch', 'DrawSession and DrawConfiguration do not belong to the requested Event.')
  if (configuration.prizeCategoryId !== category.id || category.eventId !== event.id) return failure('relationship', 'session-category-mismatch', 'DrawConfiguration and PrizeCategory do not match the requested Event.')
  if (session.mode !== input.mode) return failure('relationship', 'session-mode-mismatch', 'DrawSession mode does not match the requested mode.')
  if (session.status !== (input.expectedStatus ?? 'ready')) return failure('validation', 'session-not-ready', 'Only a ready DrawSession can start a draw.')
  if (session.configurationSnapshot !== null || session.candidatePoolSnapshot !== null) return failure('integrity', 'session-snapshots-already-attached', 'DrawSession snapshots are already attached and cannot be replaced.')
  return null
}

export async function executeDraw(
  input: DrawCommandInput,
  dependencies: DrawCommandDependencies,
): Promise<DrawCommandExecution> {
  try {
    productionUpdateLock.assertDrawOperationAllowed()
  } catch (cause: unknown) {
    return failure('validation', 'update-in-progress', 'Aplikasi sedang menyiapkan pembaruan. Undian baru tidak dapat dimulai.', cause)
  }
  let now: import('../../domain/shared/timestamps.ts').IsoTimestamp
  try {
    now = dependencies.now()
  } catch (cause: unknown) {
    return failure('validation', 'invalid-clock', 'The draw clock failed before execution.', cause)
  }
  if (!isIsoTimestamp(now)) return failure('validation', 'invalid-clock', 'The draw clock must return an ISO UTC timestamp.')

  let event: Awaited<ReturnType<DrawCommandDependencies['events']['findById']>>
  let configuration: Awaited<ReturnType<DrawCommandDependencies['configurations']['findById']>>
  let category: Awaited<ReturnType<DrawCommandDependencies['categories']['findById']>>
  let session: Awaited<ReturnType<DrawCommandDependencies['sessions']['findById']>>
  try {
    ;[event, configuration, category, session] = await Promise.all([
      dependencies.events.findById(input.eventId),
      dependencies.configurations.findById(input.configurationId),
      dependencies.categories.findById(input.prizeCategoryId),
      dependencies.sessions.findById(input.drawSessionId),
    ])
  } catch (cause: unknown) {
    return failure('persistence', 'persistence-failed', 'Authoritative draw context could not be loaded.', cause)
  }
  if (event === null) return failure('not-found', 'event-not-found', 'The requested Event was not found.')
  if (configuration === null) return failure('not-found', 'configuration-not-found', 'The requested DrawConfiguration was not found.')
  if (category === null) return failure('not-found', 'category-not-found', 'The requested PrizeCategory was not found.')
  if (session === null) return failure('not-found', 'session-not-found', 'The requested DrawSession was not found.')
  const sourceFailure = validateSources(event, configuration, category, session, input)
  if (sourceFailure !== null) return sourceFailure

  let participants: readonly import('../../domain/participants/participant.types.ts').Participant[]
  let winnerRecords: readonly import('../../domain/winners/winner.types.ts').WinnerRecord[]
  let officialSessions: readonly import('../../domain/draws/draw-session.types.ts').DrawSession[]
  try {
    ;[participants, winnerRecords, officialSessions] = await Promise.all([
      loadParticipants(dependencies, input.eventId),
      dependencies.winners.findByEventId(input.eventId),
      dependencies.sessions.findByEventId(input.eventId),
    ])
  } catch (cause: unknown) {
    return failure('persistence', 'participants-load-failed', 'Authoritative participant or winner history could not be loaded.', cause)
  }
  if (participants.length === 0) return failure('capacity', 'participants-load-failed', 'The active Event has no persisted Participants.')
  if (winnerRecords.some((winner) => winner.drawSessionId === session.id)) return failure('integrity', 'session-already-has-winners', 'The DrawSession already has WinnerRecords and cannot be started again.')

  const inFlightOfficialSessionIds = officialSessions
    .filter((candidate) => candidate.mode === 'live' && (candidate.status === 'drawing' || candidate.status === 'pending-confirmation'))
    .map((candidate) => candidate.id)
  const ruleContext = {
    activeOfficialSessionIds: inFlightOfficialSessionIds,
    officialSessions: officialSessions
      .filter((candidate) => candidate.mode === 'live' && candidate.configurationId === configuration.id)
      .map((candidate) => ({
        id: candidate.id,
        eventId: candidate.eventId,
        configurationId: candidate.configurationId,
        prizeCategoryId: category.id,
        mode: candidate.mode,
        status: candidate.status,
      })),
  }
  const capturedAt = now
  let build: ReturnType<typeof buildCandidatePool>
  try {
    build = (dependencies.buildCandidatePool ?? buildCandidatePool)({
      activeEvent: event,
      drawConfiguration: configuration,
      prizeCategory: category,
      mode: input.mode,
      participants,
      winnerRecords,
      ruleContext,
      capturedAt,
    }, (dependencies.evaluateEligibility ?? evaluateEligibility))
  } catch (cause: unknown) {
    return failure('candidate-pool', 'candidate-pool-failed', 'Candidate-pool construction failed before selection.', cause)
  }
  if (!build.ok) return failure(build.error.kind === 'capacity' ? 'capacity' : build.error.kind === 'integrity' ? 'integrity' : build.error.kind === 'relationship' ? 'relationship' : 'eligibility', 'candidate-pool-failed', build.error.message, build.error)

  if (input.mode === 'live' && dependencies.checkStorageHealth !== undefined) {
    try {
      const storage = await dependencies.checkStorageHealth()
      if (!storage.ok) return failure('persistence', 'persistence-failed', `Live draw is blocked because local persistence is not safe: ${storage.reason}`, storage)
    } catch (cause: unknown) {
      return failure('persistence', 'persistence-failed', 'Live draw is blocked because local persistence could not be verified safely.', cause)
    }
  }

  const configurationSnapshot = makeConfigurationSnapshot(configuration, category, capturedAt)
  let selection: ReturnType<typeof selectWinners>
  try {
    selection = (dependencies.selectWinners ?? selectWinners)({
      candidatePoolSnapshot: build.value.snapshot,
      configurationSnapshot,
      eventId: event.id,
      prizeCategoryId: category.id,
      mode: input.mode,
      drawSessionId: session.id,
      at: now,
      randomSource: dependencies.randomSource,
      createWinnerRecordId: dependencies.createWinnerRecordId,
    })
  } catch (cause: unknown) {
    return failure('selection', 'selection-failed', 'Winner selection failed before a result was completed.', cause)
  }
  if (!selection.ok) return failure(selection.error.kind === 'capacity' ? 'capacity' : selection.error.kind === 'integrity' || selection.error.kind === 'uniqueness' ? 'integrity' : selection.error.kind === 'random' ? 'selection' : 'selection', 'selection-failed', selection.error.message, selection.error)

  let auditRecord: DrawCommandResult['auditRecord']
  try {
    auditRecord = Object.freeze({
      id: dependencies.createAuditRecordId(),
      eventId: event.id,
      action: 'draw-session-started' as const,
      actor: dependencies.auditActor ?? { type: 'system' as const },
      detail: Object.freeze({
        eventId: event.id,
        drawSessionId: session.id,
        configurationId: configuration.id,
        configurationUpdatedAt: configuration.updatedAt,
        prizeCategoryId: category.id,
        mode: input.mode,
        winningRule: configuration.winningRule,
        requestedWinners: configuration.requestedWinners,
        eligibleCandidateCount: build.value.snapshot.eligibleSnapshotCount,
        snapshotFormatVersion: build.value.snapshot.snapshotFormatVersion,
      }),
      timestamp: now,
    })
  } catch (cause: unknown) {
    return failure('integrity', 'invalid-audit-record', 'The draw-start audit record could not be created.', cause)
  }
  const result: DrawCommandResult = Object.freeze({
    event,
    configuration,
    prizeCategory: category,
    session,
    participants: Object.freeze([...participants]),
    configurationSnapshot,
    candidatePoolSnapshot: build.value.snapshot,
    selectedCandidateEntries: selection.value.selectedCandidateEntries,
    pendingWinners: selection.value.pendingWinners,
    auditRecord,
  })
  if (input.mode === 'practice') return { ok: true, value: result }
  try {
    await dependencies.persistence.persistStartedDraw({
      drawSessionId: session.id,
      expectedStatus: input.expectedStatus ?? 'ready',
      snapshots: { configurationSnapshot, candidatePoolSnapshot: build.value.snapshot },
      winners: selection.value.pendingWinners,
      auditRecord,
      at: now,
    })
  } catch (cause: unknown) {
    return failure('persistence', 'persistence-failed', 'The Live draw could not be persisted atomically.', cause)
  }
  return { ok: true, value: result }
}

export const startDraw = executeDraw
export const runDrawCommand = executeDraw
