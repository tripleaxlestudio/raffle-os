import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'

export interface PersistReadyAuthoringInput {
  readonly configuration: DrawConfiguration
  readonly session: DrawSession
  readonly existingConfigurationId?: DrawConfiguration['id']
  readonly existingSessionId?: DrawSession['id']
}

export interface DrawAuthoringUnitOfWork {
  persistReadyAuthoring(input: PersistReadyAuthoringInput): Promise<void>
}
