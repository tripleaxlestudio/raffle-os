import type { DrawSession, DrawSessionStatus } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { DrawSetupQueryRepositories } from './draw-setup-query.types.ts'
import type { DrawSessionId } from '../../domain/shared/identifiers.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'

export type DrawSessionQueueAction =
  | { readonly kind: 'setup'; readonly to: '/draw/setup' }
  | { readonly kind: 'run'; readonly to: `/draw/run/${string}` }
  | { readonly kind: 'pending'; readonly to: `/draw/pending/${string}` }
  | { readonly kind: 'history'; readonly to: '/history' }

export type DrawSessionQueueRelation = 'valid' | 'missing-event' | 'missing-configuration' | 'missing-category'

export interface DrawSessionQueueItem {
  readonly session: DrawSession
  readonly event: Event | null
  readonly category: PrizeCategory | null
  readonly winnerCount: number
  readonly checkpoint: PresentationCheckpointRecord | null
  readonly relation: DrawSessionQueueRelation
  readonly action: DrawSessionQueueAction | null
}

export interface DrawSessionQueueResult {
  readonly event: Event
  readonly items: readonly DrawSessionQueueItem[]
}

const statusRank: Record<DrawSessionStatus, number> = {
  drawing: 0,
  'pending-confirmation': 1,
  ready: 2,
  draft: 3,
  completed: 4,
  cancelled: 5,
}

function actionFor(session: DrawSession, relation: DrawSessionQueueRelation): DrawSessionQueueAction | null {
  if (relation !== 'valid') return null
  if (session.status === 'draft') return { kind: 'setup', to: '/draw/setup' }
  if (session.status === 'ready' || session.status === 'drawing') return { kind: 'run', to: `/draw/run/${session.id}` }
  if (session.status === 'pending-confirmation') return { kind: 'pending', to: `/draw/pending/${session.id}` }
  return { kind: 'history', to: '/history' }
}

export async function queryDrawSessionQueue(
  eventId: Parameters<DrawSetupQueryRepositories['events']['findById']>[0],
  repositories: DrawSetupQueryRepositories & { readonly presentationCheckpoints?: { findByDrawSessionId(id: DrawSessionId): Promise<PresentationCheckpointRecord | null> } },
): Promise<DrawSessionQueueResult | null> {
  const event = await repositories.events.findById(eventId)
  if (event === null) return null
  const sessions = await repositories.sessions.findByEventId(event.id)
  const items = await Promise.all(sessions.map(async (session): Promise<DrawSessionQueueItem> => {
    const configuration = await repositories.configurations.findById(session.configurationId)
    const category = configuration === null ? null : await repositories.categories.findById(configuration.prizeCategoryId)
    const relation: DrawSessionQueueRelation = configuration === null
      ? 'missing-configuration'
      : configuration.eventId !== event.id || session.eventId !== event.id
        ? 'missing-configuration'
        : category === null || category.eventId !== event.id
          ? 'missing-category'
          : 'valid'
    const checkpoint = repositories.presentationCheckpoints === undefined || session.mode !== 'live'
      ? null
      : await repositories.presentationCheckpoints.findByDrawSessionId(session.id)
    return { session, event: relation === 'valid' ? event : null, category, winnerCount: configuration?.requestedWinners ?? session.configurationSnapshot?.requestedWinners ?? 0, checkpoint, relation, action: actionFor(session, relation) }
  }))
  items.sort((left, right) => statusRank[left.session.status] - statusRank[right.session.status] || right.session.updatedAt.localeCompare(left.session.updatedAt) || left.session.id.localeCompare(right.session.id))
  return { event, items }
}

