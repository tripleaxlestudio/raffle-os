import { buildCandidatePool } from './candidate-pool-builder.ts'
import { evaluateEligibility } from '../eligibility/eligibility-evaluator.ts'
import type { AppMode } from '../../domain/types/app-mode.ts'
import type { DrawSetupQueryRepositories, DrawSetupViewModel } from './draw-setup-query.types.ts'

const PAGE_SIZE = 1000

async function loadParticipants(
  repositories: DrawSetupQueryRepositories,
  eventId: Parameters<DrawSetupQueryRepositories['participants']['countByEventId']>[0],
) {
  const total = await repositories.participants.countByEventId(eventId)
  const records = [] as Awaited<ReturnType<DrawSetupQueryRepositories['participants']['findByEventId']>>
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const page = await repositories.participants.findByEventId(eventId, { limit: PAGE_SIZE, offset })
    records.push(...page)
    if (page.length === 0) break
  }
  return records
}

export async function queryDrawSetup(
  mode: AppMode,
  repositories: DrawSetupQueryRepositories,
): Promise<DrawSetupViewModel> {
  try {
    const activeEventId = await repositories.preferences.get('activeEventId')
    if (activeEventId === null) return { state: 'no-active-event', mode }

    const event = await repositories.events.findById(activeEventId)
    if (event === null) return { state: 'no-active-event', mode }

    const configurations = await repositories.configurations.findByEventId(event.id)
    const configuration = configurations[0]
    if (configuration === undefined) return { state: 'no-configuration', mode, event }

    const category = await repositories.categories.findById(configuration.prizeCategoryId)
    if (category === null || category.eventId !== event.id) {
      return { state: 'invalid-category', mode, event, configuration }
    }

    const session = await repositories.sessions.findLatestByEventId(event.id, mode)
    const totalParticipantCount = await repositories.participants.countByEventId(event.id)
    if (totalParticipantCount === 0) {
      return { state: 'no-participants', mode, event, configuration, category, session }
    }

    const participants = await loadParticipants(repositories, event.id)
    const winnerRecords = await repositories.winners.findByEventId(event.id)
    const sessions = await repositories.sessions.findByEventId(event.id)
    const officialSessions = sessions
      .filter((candidate) => candidate.mode === 'live' && candidate.configurationId === configuration.id)
      .map((candidate) => ({
        id: candidate.id,
        eventId: candidate.eventId,
        configurationId: candidate.configurationId,
        prizeCategoryId: category.id,
        mode: candidate.mode,
        status: candidate.status,
      }))
    const build = buildCandidatePool({
      activeEvent: event,
      drawConfiguration: configuration,
      prizeCategory: category,
      mode,
      participants,
      winnerRecords,
      ruleContext: {
        activeOfficialSessionIds: sessions
          .filter((candidate) => candidate.mode === 'live' && (candidate.status === 'drawing' || candidate.status === 'pending-confirmation'))
          .map((candidate) => candidate.id),
        officialSessions,
      },
      capturedAt: new Date().toISOString() as import('../../domain/shared/timestamps.ts').IsoTimestamp,
    })

    if (session === null) {
      return { state: 'no-session', mode, event, configuration, category, totalParticipantCount, eligibleCandidateCount: build.ok ? build.value.diagnostics.eligibleCount : 0, excludedCount: build.ok ? build.value.diagnostics.excludedCount : participants.length, exclusionCounts: build.ok ? build.value.diagnostics.exclusionCounts : {} }
    }

    if (!build.ok) {
      const diagnostics = evaluateEligibility({ activeEvent: event, drawConfiguration: configuration, prizeCategory: category, mode, participants, winnerRecords, ruleContext: { officialSessions } })
      const eligibleCandidateCount = diagnostics.ok ? diagnostics.value.eligibleCount : 0
      const excludedCount = diagnostics.ok ? diagnostics.value.excludedCount : participants.length
      const exclusionCounts: Record<string, number> = {}
      if (diagnostics.ok) for (const decision of diagnostics.value.decisions) for (const reason of decision.exclusionReasons) exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1
      return { state: 'blocked', mode, event, configuration, category, session, totalParticipantCount, eligibleCandidateCount, excludedCount, exclusionCounts, reason: build.error.message }
    }

    if (session.status !== 'ready') {
      return { state: 'blocked', mode, event, configuration, category, session, totalParticipantCount, eligibleCandidateCount: build.value.diagnostics.eligibleCount, excludedCount: build.value.diagnostics.excludedCount, exclusionCounts: build.value.diagnostics.exclusionCounts, reason: `This DrawSession is ${session.status.replace('-', ' ')} and cannot start another draw.` }
    }

    return { state: 'ready', mode, event, configuration, category, session, totalParticipantCount, eligibleCandidateCount: build.value.diagnostics.eligibleCount, excludedCount: build.value.diagnostics.excludedCount, exclusionCounts: build.value.diagnostics.exclusionCounts }
  } catch (cause: unknown) {
    return { state: 'query-failure', mode, error: { code: 'persistence-failed', message: 'Authoritative draw setup data could not be loaded.', cause } }
  }
}
