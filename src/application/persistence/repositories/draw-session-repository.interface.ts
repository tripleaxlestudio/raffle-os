import type {
  DrawSession,
  DrawSessionStatus,
  DrawStartSnapshots,
} from '../../../domain/draws/draw-session.types.ts'
import type {
  DrawSessionId,
  EventId,
} from '../../../domain/shared/identifiers.ts'
import type { IsoTimestamp } from '../../../domain/shared/timestamps.ts'
import type { AppMode } from '../../../domain/types/app-mode.ts'

export interface DrawSessionRepository {
  findById(id: DrawSessionId): Promise<DrawSession | null>
  findByEventId(eventId: EventId): Promise<DrawSession[]>
  findLatestByEventId(
    eventId: EventId,
    mode?: AppMode,
  ): Promise<DrawSession | null>
  createDraft(session: DrawSession): Promise<void>
  attachSnapshotsAndTransitionToDrawing(
    id: DrawSessionId,
    expectedStatus: 'ready',
    snapshots: DrawStartSnapshots,
    at: IsoTimestamp,
  ): Promise<void>
  transitionStatus(
    id: DrawSessionId,
    from: DrawSessionStatus,
    to: DrawSessionStatus,
    at: IsoTimestamp,
  ): Promise<void>
}
