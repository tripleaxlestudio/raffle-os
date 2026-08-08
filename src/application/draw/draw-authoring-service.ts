import { evaluateEligibility } from '../eligibility/eligibility-evaluator.ts'
import { validateDrawConfiguration } from '../../domain/draws/draw.invariants.ts'
import { createDrawConfigurationId, createDrawSessionId } from '../../domain/shared/identifiers.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import { isDrawSessionAuthoringLocked, type DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { EventId } from '../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../domain/shared/timestamps.ts'
import { DrawAuthoringError } from './draw-authoring-errors.ts'
import type { DrawAuthoringDraft, DrawAuthoringLoadResult, DrawAuthoringRepositories, DrawAuthoringSaveResult, DrawAuthoringService } from './draw-authoring.types.ts'
import { normalizeDrawPresentationConfiguration, validateDrawPresentationConfiguration } from '../../domain/draws/draw-presentation.types.ts'

const RULES = new Set(['once-per-event', 'once-per-category', 'allow-repeat'])
const MODES = new Set(['practice', 'live'])

function asEventId(value: string): EventId { return value as EventId }
function now(): IsoTimestamp { return new Date().toISOString() as IsoTimestamp }
function invalid(code: ConstructorParameters<typeof DrawAuthoringError>[0], message: string): DrawAuthoringSaveResult { return { ok: false, error: new DrawAuthoringError(code, message) } }

async function readRecord(repositories: DrawAuthoringRepositories, eventId: EventId, configurationId?: string, sessionId?: string) {
  const event = await repositories.events.findById(eventId)
  if (event === null) throw new DrawAuthoringError('event-not-found', 'The selected Event was not found.')
  const categories = await repositories.categories.findByEventId(event.id)
  const configuration = configurationId === undefined
    ? (await repositories.configurations.findByEventId(event.id))[0] ?? null
    : await repositories.configurations.findById(configurationId as DrawConfiguration['id'])
  if (configuration === null) {
    if (configurationId !== undefined) throw new DrawAuthoringError('configuration-not-found', 'The DrawConfiguration was not found.')
    return { event, categories, configuration: null, session: null }
  }
  if (configuration.eventId !== event.id) throw new DrawAuthoringError('cross-event-relationship', 'The DrawConfiguration belongs to another Event.')
  const category = await repositories.categories.findById(configuration.prizeCategoryId)
  if (category === null) throw new DrawAuthoringError('category-not-found', 'The selected prize category was not found.')
  if (category.eventId !== event.id) throw new DrawAuthoringError('cross-event-relationship', 'The prize category belongs to another Event.')
  const sessions = await repositories.sessions.findByEventId(event.id)
  const session = sessionId === undefined
    ? sessions.find((candidate) => candidate.configurationId === configuration.id && candidate.status === 'ready') ?? sessions.find((candidate) => candidate.configurationId === configuration.id) ?? null
    : sessions.find((candidate) => candidate.id === sessionId) ?? null
  if (session !== null && (session.eventId !== event.id || session.configurationId !== configuration.id)) throw new DrawAuthoringError('cross-event-relationship', 'The DrawSession does not belong to the selected Event and configuration.')
  return { event, categories, configuration, session }
}

async function loadParticipants(repositories: DrawAuthoringRepositories, eventId: EventId) {
  const total = await repositories.participants.countByEventId(eventId)
  return repositories.participants.findByEventId(eventId, { limit: total, offset: 0 })
}

export function createDrawAuthoringService(repositories: DrawAuthoringRepositories): DrawAuthoringService {
  return {
    async load(input = {}): Promise<DrawAuthoringLoadResult> {
      try {
        const eventId = input.eventId
        if (eventId === undefined) return { ok: true, event: null, categories: [], record: null }
        const result = await readRecord(repositories, asEventId(eventId), input.configurationId)
        if (result.configuration === null || result.session === null) return { ok: true, event: result.event, categories: result.categories, record: null }
        const category = result.categories.find((candidate) => candidate.id === result.configuration?.prizeCategoryId)
        if (category === undefined) throw new DrawAuthoringError('category-not-found', 'The selected prize category was not found.')
        const participants = await loadParticipants(repositories, result.event.id)
        const winners = await repositories.winners.findByEventId(result.event.id)
        const eligibility = evaluateEligibility({ activeEvent: result.event, drawConfiguration: result.configuration, prizeCategory: category, mode: result.session.mode, participants, winnerRecords: winners, ruleContext: { officialSessions: [] } })
        return { ok: true, event: result.event, categories: result.categories, record: { event: result.event, category, configuration: result.configuration, session: result.session, eligibleCount: eligibility.ok ? eligibility.value.eligibleCount : 0 } }
      } catch (cause: unknown) {
        const error = cause instanceof DrawAuthoringError ? cause : new DrawAuthoringError('read-failure', 'Authoritative Draw Setup data could not be read.', { retryable: true, cause })
        return { ok: false, error }
      }
    },
    async save(draft: DrawAuthoringDraft): Promise<DrawAuthoringSaveResult> {
      const requestedWinners = typeof draft.requestedWinners === 'number' ? draft.requestedWinners : Number(draft.requestedWinners)
      if (typeof draft.requestedWinners === 'string' && draft.requestedWinners.trim() === '') return invalid('invalid-winner-count', 'Winner count is required.')
      if (!Number.isInteger(requestedWinners) || requestedWinners < 1 || requestedWinners > 100) return invalid('invalid-winner-count', 'Winner count must be an integer from 1 through 100.')
      if (!MODES.has(String(draft.mode))) return invalid('invalid-mode', 'Mode must be Practice or Live.')
      if (!RULES.has(String(draft.winningRule))) return invalid('invalid-rule', 'The selected winning rule is not supported.')
      if (draft.eligibleGroupFilter !== null && draft.eligibleGroupFilter !== undefined && typeof draft.eligibleGroupFilter !== 'string') return invalid('invalid-filter', 'The eligible group filter is not supported.')
      const presentationValidation = validateDrawPresentationConfiguration(draft.presentation === undefined ? normalizeDrawPresentationConfiguration(undefined) : draft.presentation)
      if (!presentationValidation.ok) return invalid('invalid-presentation', presentationValidation.error.message)
      const presentation = presentationValidation.value
      const groupFilter = typeof draft.eligibleGroupFilter === 'string' ? draft.eligibleGroupFilter.trim() : null
      try {
        const eventId = asEventId(draft.eventId)
        const loaded = await readRecord(repositories, eventId, draft.configurationId, draft.sessionId)
        const category = loaded.categories.find((candidate) => candidate.id === draft.prizeCategoryId)
        if (category === undefined) return invalid('category-not-found', 'The selected prize category was not found.')
        if (category.eventId !== eventId) return invalid('cross-event-relationship', 'The selected prize category belongs to another Event.')
        if (draft.configurationId !== undefined && loaded.configuration === null) return invalid('configuration-not-found', 'The DrawConfiguration was not found.')
        if (draft.sessionId !== undefined && loaded.session === null) return invalid('session-not-found', 'The DrawSession was not found.')
        if (loaded.session !== null && isDrawSessionAuthoringLocked(loaded.session)) return invalid('session-not-editable', 'An active DrawSession cannot be edited. Resolve the active draw before changing its configuration.')
        const timestamp = now()
        const configuration: DrawConfiguration = loaded.configuration ?? { id: createDrawConfigurationId(), eventId, prizeCategoryId: category.id, requestedWinners, winningRule: draft.winningRule as DrawConfiguration['winningRule'], requireCheckIn: draft.requireCheckIn, eligibleGroupFilter: groupFilter, presentation, createdAt: timestamp, updatedAt: timestamp }
        const updatedConfiguration: DrawConfiguration = { ...configuration, eventId, prizeCategoryId: category.id, requestedWinners, winningRule: draft.winningRule as DrawConfiguration['winningRule'], requireCheckIn: draft.requireCheckIn, eligibleGroupFilter: groupFilter, presentation, updatedAt: timestamp }
        const reuseSession = loaded.session === null || loaded.session.status === 'ready'
        const session: DrawSession = reuseSession && loaded.session !== null
          ? loaded.session
          : { id: createDrawSessionId(), eventId, configurationId: updatedConfiguration.id, mode: draft.mode as DrawSession['mode'], status: 'ready', configurationSnapshot: null, candidatePoolSnapshot: null, createdAt: timestamp, updatedAt: timestamp }
        const updatedSession: DrawSession = { ...session, eventId, configurationId: updatedConfiguration.id, mode: draft.mode as DrawSession['mode'], status: 'ready', updatedAt: timestamp }
        const valid = validateDrawConfiguration(updatedConfiguration)
        if (!valid.ok) return invalid('write-failure', valid.error.message)
        const participants = await loadParticipants(repositories, eventId)
        const winners = await repositories.winners.findByEventId(eventId)
        const eligibility = evaluateEligibility({ activeEvent: loaded.event, drawConfiguration: updatedConfiguration, prizeCategory: category, mode: updatedSession.mode, participants, winnerRecords: winners, ruleContext: { officialSessions: [] } })
        if (eligibility.ok && eligibility.value.eligibleCount < requestedWinners) return invalid('insufficient-eligible-capacity', `Only ${eligibility.value.eligibleCount} eligible participants are available for ${requestedWinners} winners.`)
        if (repositories.authoring === undefined) return { ok: false, error: new DrawAuthoringError('persistence-unavailable', 'Draw authoring persistence is unavailable.', { retryable: true }) }
        await repositories.authoring.persistReadyAuthoring({ configuration: updatedConfiguration, session: updatedSession, existingConfigurationId: loaded.configuration?.id, existingSessionId: reuseSession ? loaded.session?.id : undefined })
        const readyEvent = loaded.event.status === 'draft' ? { ...loaded.event, status: 'ready' as const, updatedAt: timestamp } : loaded.event
        return { ok: true, record: { event: readyEvent, category, configuration: updatedConfiguration, session: updatedSession, eligibleCount: eligibility.ok ? eligibility.value.eligibleCount : 0 } }
      } catch (cause: unknown) {
        if (cause instanceof DrawAuthoringError) return { ok: false, error: cause }
        const code = typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'duplicate-record' ? 'duplicate-save' : 'write-failure'
        return { ok: false, error: new DrawAuthoringError(code, 'The Draw Setup could not be saved atomically. No partial configuration or session was kept.', { retryable: code === 'write-failure', cause }) }
      }
    },
  }
}
