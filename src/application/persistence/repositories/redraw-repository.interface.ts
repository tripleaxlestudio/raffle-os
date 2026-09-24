import type {
  DrawSessionId,
  WinnerRecordId,
} from '../../../domain/shared/identifiers.ts'
import type { RedrawRecord } from '../../../domain/winners/redraw.types.ts'

export interface RedrawRepository {
  findByDrawSessionId(
    drawSessionId: DrawSessionId,
  ): Promise<RedrawRecord[]>
  findByOriginalWinnerId(
    winnerId: WinnerRecordId,
  ): Promise<RedrawRecord | null>
  append(redraw: RedrawRecord): Promise<void>
}

/** Read-only boundary for redraw lineage projections. */
export type RedrawReadRepository = Pick<RedrawRepository, 'findByDrawSessionId' | 'findByOriginalWinnerId'>
