import type { DrawAuthoringDraft } from './draw-authoring.types.ts'
import type { DrawSetupQueryRepositories } from './draw-setup-query.types.ts'
import type { DrawConfiguration, WinningRule } from '../../domain/draws/draw-configuration.types.ts'
import type { EventId } from '../../domain/shared/identifiers.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import { evaluateEligibility } from '../eligibility/eligibility-evaluator.ts'

const PAGE_SIZE = 1000
const WINNING_RULES = new Set<WinningRule>(['once-per-event', 'once-per-category', 'allow-repeat'])
const MODES = new Set<AppMode>(['practice', 'live'])

export interface DrawCapacityPreviewData {
  readonly totalParticipantCount: number
  readonly checkedInParticipantCount: number
  readonly previousWinnerExcludedCount: number
  readonly eligibleParticipantCount: number
  readonly requestedWinnerCount: number
}

export type DrawCapacityPreviewResult =
  | { readonly state: 'ready'; readonly data: DrawCapacityPreviewData }
  | { readonly state: 'unavailable'; readonly reason: string }

function parseRequestedWinners(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : null
}

function parseWinningRule(value: unknown): WinningRule | null {
  return typeof value === 'string' && WINNING_RULES.has(value as WinningRule) ? value as WinningRule : null
}

function parseMode(value: unknown): AppMode | null {
  return typeof value === 'string' && MODES.has(value as AppMode) ? value as AppMode : null
}

async function loadParticipants(repositories: DrawSetupQueryRepositories, eventId: EventId) {
  const total = await repositories.participants.countByEventId(eventId)
  const participants = [] as Awaited<ReturnType<DrawSetupQueryRepositories['participants']['findByEventId']>>
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const page = await repositories.participants.findByEventId(eventId, { limit: PAGE_SIZE, offset })
    participants.push(...page)
    if (page.length === 0) break
  }
  return participants
}

/**
 * Evaluates capacity from the current authoring draft without persisting it.
 * Start readiness remains a separate, authoritative persisted-data query.
 */
export async function queryDrawCapacityPreview(
  draft: DrawAuthoringDraft,
  repositories: DrawSetupQueryRepositories,
): Promise<DrawCapacityPreviewResult> {
  try {
    const requestedWinners = parseRequestedWinners(draft.requestedWinners)
    const winningRule = parseWinningRule(draft.winningRule)
    const mode = parseMode(draft.mode)
    if (requestedWinners === null || winningRule === null || mode === null) {
      return { state: 'unavailable', reason: 'The current draft contains values that cannot be evaluated.' }
    }

    const event = await repositories.events.findById(draft.eventId as EventId)
    if (event === null) return { state: 'unavailable', reason: 'The active Event is unavailable.' }
    const categories = await repositories.categories.findByEventId(event.id)
    const category = categories.find((candidate) => candidate.id === draft.prizeCategoryId)
    if (category === undefined) return { state: 'unavailable', reason: 'The selected prize category is unavailable.' }

    const [participants, winners, sessions] = await Promise.all([
      loadParticipants(repositories, event.id),
      repositories.winners.findByEventId(event.id),
      repositories.sessions.findByEventId(event.id),
    ])
    const resolvedOfficialSessions = await Promise.all(sessions
      .filter((candidate) => candidate.mode === 'live')
      .map(async (candidate) => {
        const configuration = await repositories.configurations.findById(candidate.configurationId)
        if (configuration === null || configuration.eventId !== event.id) return null
        return {
          id: candidate.id,
          eventId: candidate.eventId,
          configurationId: candidate.configurationId,
          prizeCategoryId: configuration.prizeCategoryId,
          mode: candidate.mode,
          status: candidate.status,
        }
      }))
    if (resolvedOfficialSessions.some((candidate) => candidate === null)) {
      return { state: 'unavailable', reason: 'Historical Live session data is unavailable or inconsistent.' }
    }

    const configuration: DrawConfiguration = {
      id: (draft.configurationId ?? 'draft-capacity-preview') as DrawConfiguration['id'],
      eventId: event.id,
      prizeCategoryId: category.id,
      requestedWinners,
      winningRule,
      requireCheckIn: draft.requireCheckIn,
      eligibleGroupFilter: typeof draft.eligibleGroupFilter === 'string' && draft.eligibleGroupFilter.trim() !== '' ? draft.eligibleGroupFilter.trim() : null,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }
    const eligibility = evaluateEligibility({
      activeEvent: event,
      drawConfiguration: configuration,
      prizeCategory: category,
      mode,
      participants,
      winnerRecords: winners,
      ruleContext: {
        officialSessions: resolvedOfficialSessions.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null),
      },
    })
    if (!eligibility.ok) return { state: 'unavailable', reason: eligibility.error.message }

    return {
      state: 'ready',
      data: {
        totalParticipantCount: participants.length,
        checkedInParticipantCount: participants.filter((participant) => participant.isCheckedIn).length,
        previousWinnerExcludedCount: eligibility.value.decisions.filter((decision) => decision.exclusionReasons.includes('previously-confirmed-winner')).length,
        eligibleParticipantCount: eligibility.value.eligibleCount,
        requestedWinnerCount: requestedWinners,
      },
    }
  } catch {
    return { state: 'unavailable', reason: 'Draft capacity could not be evaluated from local data.' }
  }
}
