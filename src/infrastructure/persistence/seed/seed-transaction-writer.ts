import type { AuditRecord } from '../../../domain/audit/audit.types.ts'
import type { DisplayConfiguration } from '../../../domain/display/display-configuration.types.ts'
import {
  validateDrawConfiguration,
  validateDrawSession,
} from '../../../domain/draws/draw.invariants.ts'
import type { DrawConfiguration } from '../../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../../domain/draws/draw-session.types.ts'
import { validateEvent } from '../../../domain/events/event.invariants.ts'
import type { Event } from '../../../domain/events/event.types.ts'
import { validateParticipant } from '../../../domain/participants/participant.invariants.ts'
import type { Participant } from '../../../domain/participants/participant.types.ts'
import type { ApplicationPreference } from '../../../domain/preferences/application-preference.types.ts'
import type { PrizeCategory } from '../../../domain/prizes/prize.types.ts'
import {
  validateRedrawRelationship,
  validateWinnerRecord,
} from '../../../domain/winners/winner.invariants.ts'
import type { RedrawRecord } from '../../../domain/winners/redraw.types.ts'
import type { WinnerRecord } from '../../../domain/winners/winner.types.ts'
import type { RaffleOSDatabase } from '../db.ts'
import { RelationshipMismatchError } from '../errors/persistence-errors.ts'
import { requireValid } from '../repositories/repository-helpers.ts'

export interface ValidatedSeedDataset {
  readonly events: readonly Event[]
  readonly prizeCategories: readonly PrizeCategory[]
  readonly drawConfigurations: readonly DrawConfiguration[]
  readonly displayConfigurations: readonly DisplayConfiguration[]
  readonly participants: readonly Participant[]
  readonly drawSession?: DrawSession
  readonly drawSessions?: readonly DrawSession[]
  readonly winners?: readonly WinnerRecord[]
  readonly redrawRecord?: RedrawRecord
  readonly auditRecords?: readonly AuditRecord[]
  readonly preferences?: readonly ApplicationPreference[]
}

export function validateSeedDataset(dataset: ValidatedSeedDataset): void {
  // 1. Validate Events
  const eventIds = new Set<string>()
  for (const event of dataset.events) {
    requireValid(validateEvent(event))
    eventIds.add(event.id)
  }

  // 2. Validate PrizeCategories
  const prizeCategoryMap = new Map<string, PrizeCategory>()
  for (const category of dataset.prizeCategories) {
    if (!eventIds.has(category.eventId)) {
      throw new RelationshipMismatchError(
        'PrizeCategory must belong to a seeded Event.',
      )
    }
    prizeCategoryMap.set(category.id, category)
  }

  // 3. Validate DrawConfigurations
  const drawConfigMap = new Map<string, DrawConfiguration>()
  for (const config of dataset.drawConfigurations) {
    requireValid(validateDrawConfiguration(config))
    if (!eventIds.has(config.eventId)) {
      throw new RelationshipMismatchError(
        'DrawConfiguration must belong to a seeded Event.',
      )
    }
    const category = prizeCategoryMap.get(config.prizeCategoryId)
    if (category === undefined) {
      throw new RelationshipMismatchError(
        'DrawConfiguration must reference a seeded PrizeCategory.',
      )
    }
    if (category.eventId !== config.eventId) {
      throw new RelationshipMismatchError(
        'DrawConfiguration and PrizeCategory must belong to the same Event.',
      )
    }
    drawConfigMap.set(config.id, config)
  }

  // 4. Validate DisplayConfigurations
  const displayEventIds = new Set<string>()
  for (const display of dataset.displayConfigurations) {
    if (!eventIds.has(display.eventId)) {
      throw new RelationshipMismatchError(
        'DisplayConfiguration must belong to a seeded Event.',
      )
    }
    if (displayEventIds.has(display.eventId)) {
      throw new RelationshipMismatchError(
        'Only one DisplayConfiguration per Event is allowed.',
      )
    }
    displayEventIds.add(display.eventId)
  }

  // 5. Validate Participants
  const participantMap = new Map<string, Participant>()
  const participantTicketPairs = new Set<string>()
  for (const participant of dataset.participants) {
    requireValid(validateParticipant(participant))
    if (!eventIds.has(participant.eventId)) {
      throw new RelationshipMismatchError(
        'Participant must belong to a seeded Event.',
      )
    }
    const pairKey = `${participant.eventId}:${participant.ticketNumber}`
    if (participantTicketPairs.has(pairKey)) {
      throw new RelationshipMismatchError(
        'Duplicate ticket number found within the same Event.',
      )
    }
    participantTicketPairs.add(pairKey)
    participantMap.set(participant.id, participant)
  }

  // 6. Validate DrawSession and History if present
  const drawSessions = dataset.drawSessions ?? (dataset.drawSession === undefined ? [] : [dataset.drawSession])
  for (const session of drawSessions) {
    if (!eventIds.has(session.eventId)) {
      throw new RelationshipMismatchError(
        'DrawSession must belong to a seeded Event.',
      )
    }

    const config = drawConfigMap.get(session.configurationId)
    if (config === undefined) {
      throw new RelationshipMismatchError(
        'DrawSession must reference a seeded DrawConfiguration.',
      )
    }
    if (config.eventId !== session.eventId) {
      throw new RelationshipMismatchError(
        'DrawSession and DrawConfiguration must belong to the same Event.',
      )
    }

    requireValid(validateDrawSession(session))

    if (session.configurationSnapshot === null) {
      if (session.status !== 'ready') {
        throw new RelationshipMismatchError(
          'A non-ready seeded DrawSession requires a configuration snapshot.',
        )
      }
      if (session.candidatePoolSnapshot !== null) {
        throw new RelationshipMismatchError(
          'A ready DrawSession without a configuration snapshot cannot have a candidate pool snapshot.',
        )
      }
    }

    if (session.configurationSnapshot === null) {
      continue
    }

    const configurationSnapshot = session.configurationSnapshot
    if (
      configurationSnapshot.configurationId !== config.id ||
      configurationSnapshot.prizeCategoryId !== config.prizeCategoryId ||
      configurationSnapshot.requestedWinners !== config.requestedWinners ||
      configurationSnapshot.winningRule !== config.winningRule ||
      configurationSnapshot.requireCheckIn !== config.requireCheckIn ||
      configurationSnapshot.eligibleGroupFilter !== config.eligibleGroupFilter
    ) {
      throw new RelationshipMismatchError(
        'DrawConfigurationSnapshot identity and required values must match the DrawConfiguration.',
      )
    }

    if (session.candidatePoolSnapshot === null) {
      throw new RelationshipMismatchError(
        'Seeded official DrawSession requires a candidate pool snapshot.',
      )
    }

    // Check candidate pool matches participants
    const candidateTicketByParticipantId = new Map<string, string>()
    for (const candidate of session.candidatePoolSnapshot.candidateEntries) {
      const participant = participantMap.get(candidate.participantId)
      if (participant === undefined) {
        throw new RelationshipMismatchError(
          'Candidate pool entry references an unseeded Participant.',
        )
      }
      if (participant.eventId !== session.eventId) {
        throw new RelationshipMismatchError(
          'Candidate pool Participant must belong to the DrawSession Event.',
        )
      }
      if (participant.ticketNumber !== candidate.ticketNumber) {
        throw new RelationshipMismatchError(
          'Candidate pool ticket number mismatches Participant ticket number.',
        )
      }
      candidateTicketByParticipantId.set(
        candidate.participantId,
        candidate.ticketNumber,
      )
    }

    // 7. Validate Winners
    if (dataset.winners !== undefined && dataset.winners.length > 0) {
      const winnerMap = new Map<string, WinnerRecord>()
      const sequences = new Set<number>()

      for (const winner of dataset.winners) {
        requireValid(validateWinnerRecord(winner))
        if (winner.drawSessionId !== session.id) {
          throw new RelationshipMismatchError(
            'WinnerRecord must belong to the seeded DrawSession.',
          )
        }
        if (winner.eventId !== session.eventId) {
          throw new RelationshipMismatchError(
            'WinnerRecord eventId must match the DrawSession Event.',
          )
        }
        if (winner.prizeCategoryId !== config.prizeCategoryId) {
          throw new RelationshipMismatchError(
            'WinnerRecord prizeCategoryId must match the configuration.',
          )
        }
        const participant = participantMap.get(winner.participantId)
        if (participant === undefined) {
          throw new RelationshipMismatchError(
            'WinnerRecord must reference a seeded Participant.',
          )
        }
        if (
          participant.eventId !== session.eventId ||
          participant.ticketNumber !== winner.ticketNumber
        ) {
          throw new RelationshipMismatchError(
            'WinnerRecord Event and ticket must match the Participant.',
          )
        }
        if (
          candidateTicketByParticipantId.get(winner.participantId) !==
          winner.ticketNumber
        ) {
          throw new RelationshipMismatchError(
            'WinnerRecord participant and ticket must be present in the candidate pool snapshot.',
          )
        }
        if (sequences.has(winner.sequenceNumber)) {
          throw new RelationshipMismatchError(
            'WinnerRecord sequence numbers must be unique within the DrawSession.',
          )
        }
        sequences.add(winner.sequenceNumber)
        winnerMap.set(winner.id, winner)
      }

      // 8. Validate RedrawRecord if present
      if (dataset.redrawRecord !== undefined) {
        const redraw = dataset.redrawRecord
        const original = winnerMap.get(redraw.originalWinnerRecordId)
        const replacement = winnerMap.get(redraw.replacementWinnerRecordId)

        if (original === undefined || replacement === undefined) {
          throw new RelationshipMismatchError(
            'RedrawRecord must reference valid seeded original and replacement WinnerRecords.',
          )
        }

        requireValid(
          validateRedrawRelationship(redraw, original, replacement),
        )
      }
    }
  }

  // 9. Validate AuditRecords if present
  if (dataset.auditRecords !== undefined) {
    for (const audit of dataset.auditRecords) {
      if (!eventIds.has(audit.eventId)) {
        throw new RelationshipMismatchError(
          'AuditRecord must belong to a seeded Event.',
        )
      }
    }
  }
}

export async function writeValidatedSeedDataset(
  database: RaffleOSDatabase,
  dataset: ValidatedSeedDataset,
): Promise<void> {
  // First, enforce complete domain and relationship validation before writing anything
  validateSeedDataset(dataset)

  // Perform add / bulkAdd operations within active transaction context
  if (dataset.events.length > 0) {
    await database.events.bulkAdd(dataset.events)
  }
  if (dataset.prizeCategories.length > 0) {
    await database.prize_categories.bulkAdd(dataset.prizeCategories)
  }
  if (dataset.drawConfigurations.length > 0) {
    await database.draw_configurations.bulkAdd(dataset.drawConfigurations)
  }
  if (dataset.displayConfigurations.length > 0) {
    await database.display_configurations.bulkAdd(dataset.displayConfigurations)
  }
  if (dataset.participants.length > 0) {
    await database.participants.bulkAdd(dataset.participants)
  }
  const drawSessions = dataset.drawSessions ?? (dataset.drawSession === undefined ? [] : [dataset.drawSession])
  if (drawSessions.length > 0) {
    await database.draw_sessions.bulkAdd(drawSessions)
  }
  if (dataset.winners !== undefined && dataset.winners.length > 0) {
    await database.winner_records.bulkAdd(dataset.winners)
  }
  if (dataset.redrawRecord !== undefined) {
    await database.redraw_records.add(dataset.redrawRecord)
  }
  if (dataset.auditRecords !== undefined && dataset.auditRecords.length > 0) {
    await database.audit_records.bulkAdd(dataset.auditRecords)
  }
  if (dataset.preferences !== undefined && dataset.preferences.length > 0) {
    await database.preferences.bulkAdd(dataset.preferences)
  }
}
