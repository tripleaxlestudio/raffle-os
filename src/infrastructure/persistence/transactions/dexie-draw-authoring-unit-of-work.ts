import type { DrawAuthoringUnitOfWork, PersistReadyAuthoringInput } from '../../../application/persistence/draw-authoring-unit-of-work.interface.ts'
import { validateDrawConfiguration } from '../../../domain/draws/draw.invariants.ts'
import { validateDrawSession } from '../../../domain/draws/draw.invariants.ts'
import { RelationshipMismatchError, ImmutableRecordError, RecordNotFoundError, ValidationError } from '../errors/persistence-errors.ts'
import { normalizeRepositoryError, requireValid } from '../repositories/repository-helpers.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { transitionEventStatus } from '../../../domain/events/event.invariants.ts'

const NON_EDITABLE = new Set(['drawing', 'pending-confirmation', 'completed', 'cancelled'])

export class DexieDrawAuthoringUnitOfWork implements DrawAuthoringUnitOfWork {
  private readonly database: RaffleOSDatabase

  constructor(database: RaffleOSDatabase) {
    this.database = database
  }

  async persistReadyAuthoring(input: PersistReadyAuthoringInput): Promise<void> {
    try {
      requireValid(validateDrawConfiguration(input.configuration))
      requireValid(validateDrawSession(input.session))
      if (input.session.status !== 'ready' || input.session.configurationSnapshot !== null || input.session.candidatePoolSnapshot !== null) throw new ValidationError('A persisted authoring session must be ready and snapshot-free.')
      if (input.configuration.eventId !== input.session.eventId || input.configuration.id !== input.session.configurationId) throw new RelationshipMismatchError('The DrawConfiguration and ready DrawSession must belong to the same Event and configuration.')
      await this.database.transaction('rw', [this.database.events, this.database.prize_categories, this.database.draw_configurations, this.database.draw_sessions], async () => {
        const event = await this.database.events.get(input.configuration.eventId)
        if (event === undefined) throw new RelationshipMismatchError('The parent Event was not found.')
        const category = await this.database.prize_categories.get(input.configuration.prizeCategoryId)
        if (category === undefined) throw new RelationshipMismatchError('The selected PrizeCategory was not found.')
        if (category.eventId !== event.id) throw new RelationshipMismatchError('The PrizeCategory must belong to the selected Event.')
        const currentConfiguration = await this.database.draw_configurations.get(input.configuration.id)
        const currentSession = await this.database.draw_sessions.get(input.session.id)
        if (input.existingConfigurationId !== undefined && currentConfiguration === undefined) throw new RecordNotFoundError('The DrawConfiguration required for update was not found.')
        if (input.existingSessionId !== undefined && currentSession === undefined) throw new RecordNotFoundError('The DrawSession required for update was not found.')
        if (currentConfiguration !== undefined && currentConfiguration.eventId !== event.id) throw new RelationshipMismatchError('The DrawConfiguration cannot be reassigned to another Event.')
        if (currentSession !== undefined) {
          if (currentSession.eventId !== event.id || currentSession.configurationId !== input.configuration.id) throw new RelationshipMismatchError('The DrawSession relationship does not match the selected Event and configuration.')
          if (NON_EDITABLE.has(currentSession.status)) throw new ImmutableRecordError('A started DrawSession cannot be edited or reset to ready.')
        }
        const readyEvent = event.status === 'draft'
          ? (() => {
              const transition = transitionEventStatus(event, 'ready', input.configuration.updatedAt)
              if (!transition.ok) throw new ValidationError(transition.error.message, { cause: transition.error })
              return transition.value
            })()
          : event
        await this.database.events.put(readyEvent)
        await this.database.draw_configurations.put(input.configuration)
        await this.database.draw_sessions.put(input.session)
      })
    } catch (cause: unknown) {
      throw normalizeRepositoryError(cause, 'Persisting ready Draw authoring')
    }
  }
}
