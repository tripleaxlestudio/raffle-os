import type { RedrawRequestRepository } from '../../../application/persistence/repositories/redraw-request-repository.interface.ts'
import type { CommandId, DrawSessionId } from '../../../domain/shared/identifiers.ts'
import type { RedrawRequest } from '../../../domain/winners/redraw-request.types.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { normalizeRepositoryError } from './repository-helpers.ts'

export class DexieRedrawRequestRepository implements RedrawRequestRepository {
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async findById(id: CommandId): Promise<RedrawRequest | null> {
    try {
      return (await this.database.redraw_requests.get(id)) ?? null
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Reading a redraw request')
    }
  }

  async findActiveByDrawSessionId(drawSessionId: DrawSessionId): Promise<RedrawRequest | null> {
    const requests = await this.findByDrawSessionId(drawSessionId)
    return requests.find((request) => request.status !== 'completed') ?? null
  }

  async findByDrawSessionId(drawSessionId: DrawSessionId): Promise<readonly RedrawRequest[]> {
    try {
      const requests = await this.database.redraw_requests.where('drawSessionId').equals(drawSessionId).toArray()
      return requests.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    } catch (error: unknown) {
      throw normalizeRepositoryError(error, 'Listing redraw requests')
    }
  }
}
