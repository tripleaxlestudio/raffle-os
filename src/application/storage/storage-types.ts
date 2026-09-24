import type { AuditRecord } from '../../domain/audit/audit.types.ts'
import type { DisplayConfiguration } from '../../domain/display/display-configuration.types.ts'
import type { DrawConfiguration } from '../../domain/draws/draw-configuration.types.ts'
import type { DrawSession } from '../../domain/draws/draw-session.types.ts'
import type { Event } from '../../domain/events/event.types.ts'
import type { Participant } from '../../domain/participants/participant.types.ts'
import type { ApplicationPreference } from '../../domain/preferences/application-preference.types.ts'
import type { PresentationSettings } from '../../domain/settings/presentation-settings.types.ts'
import type { PrizeCategory } from '../../domain/prizes/prize.types.ts'
import type { EventId } from '../../domain/shared/identifiers.ts'
import type { RedrawRecord } from '../../domain/winners/redraw.types.ts'
import type { RedrawRequest } from '../../domain/winners/redraw-request.types.ts'
import type { WinnerRecord } from '../../domain/winners/winner.types.ts'
import type { PresentationCheckpointRecord } from '../../domain/workflow/presentation-checkpoint.types.ts'
import type { CommandReceiptRecord } from '../persistence/command-receipt-repository.interface.ts'

export interface SerializedLocalAsset {
  readonly name: string
  readonly type: string
  readonly size: number
  readonly base64: string
}

export interface SerializedEventSettings {
  readonly eventId: EventId
  readonly displayName: string
  readonly subtitle: string
  readonly primaryColor: string
  readonly accentColor: string
  readonly presentation: PresentationSettings
  readonly audioEnabled: boolean
  readonly masterVolume: number
  readonly logo?: SerializedLocalAsset
  readonly background?: SerializedLocalAsset
  readonly revealCue?: SerializedLocalAsset
  readonly updatedAt: string
}

export interface KocokanBackupData {
  readonly events: readonly Event[]
  readonly participants: readonly Participant[]
  readonly prizeCategories: readonly PrizeCategory[]
  readonly drawConfigurations: readonly DrawConfiguration[]
  readonly displayConfigurations: readonly DisplayConfiguration[]
  readonly eventSettings: readonly SerializedEventSettings[]
  readonly drawSessions: readonly DrawSession[]
  readonly winnerRecords: readonly WinnerRecord[]
  readonly redrawRecords: readonly RedrawRecord[]
  /** Optional so backup format v1 files created before redraw requests remain restorable. */
  readonly redrawRequests?: readonly RedrawRequest[]
  readonly auditRecords: readonly AuditRecord[]
  readonly preferences: readonly ApplicationPreference[]
  readonly presentationCheckpoints: readonly PresentationCheckpointRecord[]
  readonly commandReceipts: readonly CommandReceiptRecord[]
}

export interface KocokanBackupEnvelope {
  readonly format: 'kocokan-backup'
  readonly version: 1
  readonly createdAt: string
  readonly appVersion: string
  readonly data: KocokanBackupData
}

export interface StorageStatistics {
  readonly databaseStatus: 'ready' | 'error'
  readonly databaseError?: string
  readonly eventCount: number
  readonly participantCount: number
  readonly officialHistoryCount: number
  readonly storageBytes: number
  readonly formattedStorageSize: string
}

export interface BackupPreviewSummary {
  readonly createdAt: string
  readonly appVersion: string
  readonly version: number
  readonly eventCount: number
  readonly participantCount: number
  readonly officialHistoryCount: number
  readonly totalSessionsCount: number
}

export type StorageOperationStatus = 'idle' | 'working' | 'success' | 'error'
