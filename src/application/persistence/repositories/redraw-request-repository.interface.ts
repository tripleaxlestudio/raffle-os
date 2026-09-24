import type { CommandId, DrawSessionId } from '../../../domain/shared/identifiers.ts'
import type { RedrawRequest } from '../../../domain/winners/redraw-request.types.ts'

export interface RedrawRequestRepository {
  findById(id: CommandId): Promise<RedrawRequest | null>
  findActiveByDrawSessionId(drawSessionId: DrawSessionId): Promise<RedrawRequest | null>
  findByDrawSessionId(drawSessionId: DrawSessionId): Promise<readonly RedrawRequest[]>
}
